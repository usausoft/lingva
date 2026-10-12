//! Read-only source traversal and literal translation-call extraction.
//!
//! Symbolic expressions are never evaluated. Comments and quoted non-code are
//! skipped, and symbolic template literals are excluded from static key reports.

use crate::{
    OutputFormat,
    customer::{ArtifactArgs, policy, report},
    project::Project,
};
use anyhow::{Context, Result};
use clap::{Args, ValueEnum};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

const DEFAULT_EXTENSIONS: [&str; 6] = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];
const IGNORED_DIRECTORIES: [&str; 6] =
    ["node_modules", ".git", ".lingva", "target", "dist", ".next"];

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum FailOn {
    Missing,
    Unused,
    Any,
    Dynamic,
    None,
}

#[derive(Debug, Args)]
pub struct ExtractArgs {
    pub input: PathBuf,
    #[arg(long)]
    pub project: Option<PathBuf>,
    #[arg(long)]
    pub config: Option<PathBuf>,
    #[arg(long)]
    pub policy: Option<String>,
    #[arg(long, value_delimiter = ',')]
    pub extensions: Vec<String>,
    #[arg(long, value_delimiter = ',')]
    pub exclude: Vec<String>,
    /// Exact call targets, such as lingva.t or t; defaults to any t/tSync call.
    #[arg(long, value_delimiter = ',')]
    pub callee: Vec<String>,
    #[arg(long, value_enum)]
    pub fail_on: Option<FailOn>,
    #[arg(long)]
    pub output: Option<PathBuf>,
    #[arg(long)]
    pub no_summary: bool,
    #[arg(long, value_enum, default_value_t = OutputFormat::Text)]
    pub format: OutputFormat,
}

pub fn collect_files(path: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    let metadata = fs::symlink_metadata(path)
        .with_context(|| format!("Cannot inspect {}.", path.display()))?;
    // Never follow symlink cycles or traverse out of the selected source tree.
    if metadata.file_type().is_symlink() {
        return Ok(());
    }
    if metadata.is_file() {
        files.push(path.to_owned());
    } else if metadata.is_dir() {
        let mut entries = fs::read_dir(path)?
            .map(|entry| entry.map(|entry| entry.path()))
            .collect::<std::io::Result<Vec<_>>>()?;
        entries.sort();
        for entry in entries {
            if entry
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| IGNORED_DIRECTORIES.contains(&name))
            {
                continue;
            }
            collect_files(&entry, files)?;
        }
    }
    Ok(())
}

/// Match portable `*`/`?` globs without interpreting regex metacharacters.
pub fn glob_matches(pattern: &str, value: &str) -> bool {
    let pattern = pattern.as_bytes();
    let value = value.as_bytes();
    let (mut p, mut v, mut star, mut matched) = (0, 0, None, 0);
    while v < value.len() {
        if p < pattern.len() && (pattern[p] == b'?' || pattern[p] == value[v]) {
            p += 1;
            v += 1;
        } else if p < pattern.len() && pattern[p] == b'*' {
            star = Some(p);
            p += 1;
            matched = v;
        } else if let Some(previous) = star {
            matched += 1;
            v = matched;
            p = previous + 1;
        } else {
            return false;
        }
    }
    while p < pattern.len() && pattern[p] == b'*' {
        p += 1;
    }
    p == pattern.len()
}

/// Decode a static JS string without executing customer code.
fn decode_literal(source: &str) -> Result<String> {
    let mut chars = source[1..source.len() - 1].chars().peekable();
    let mut output = String::new();
    while let Some(character) = chars.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }
        let escaped = chars.next().context("Unterminated string escape.")?;
        match escaped {
            'n' => output.push('\n'),
            'r' => output.push('\r'),
            't' => output.push('\t'),
            'b' => output.push('\u{0008}'),
            'f' => output.push('\u{000c}'),
            'v' => output.push('\u{000b}'),
            '\n' => {}
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
            }
            'x' | 'u' => {
                let mut hex = String::new();
                if escaped == 'u' && chars.peek() == Some(&'{') {
                    chars.next();
                    loop {
                        let next = chars.next().context("Unterminated Unicode escape.")?;
                        if next == '}' {
                            break;
                        }
                        hex.push(next);
                    }
                } else {
                    for _ in 0..if escaped == 'x' { 2 } else { 4 } {
                        hex.push(chars.next().context("Incomplete Unicode escape.")?);
                    }
                }
                let number = u32::from_str_radix(&hex, 16).context("Invalid Unicode escape.")?;
                output.push(
                    char::from_u32(number)
                        .context("Translation keys cannot contain a Unicode surrogate.")?,
                );
            }
            '0' => output.push('\0'),
            character => output.push(character),
        }
    }
    Ok(output)
}

/// Parse real JS/TS syntax: regex literals and JSX text are not call expressions.
#[cfg(test)]
pub fn keys(source: &str, extension: &str) -> Result<Vec<(String, usize)>> {
    Ok(scan(source, extension, &[])?.keys)
}

struct Scan {
    keys: Vec<(String, usize)>,
    dynamic: Vec<usize>,
}

fn scan(source: &str, extension: &str, callees: &[String]) -> Result<Scan> {
    let language = match extension {
        "tsx" => tree_sitter_typescript::LANGUAGE_TSX.into(),
        "ts" => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        _ => tree_sitter_javascript::LANGUAGE.into(),
    };
    let mut parser = tree_sitter::Parser::new();
    parser.set_language(&language)?;
    let tree = parser.parse(source, None).context("Cannot parse source.")?;
    if tree.root_node().has_error() {
        anyhow::bail!("Source contains invalid {extension} syntax.");
    }
    let mut pending = vec![tree.root_node()];
    let mut output = BTreeSet::new();
    let mut dynamic = BTreeSet::new();
    while let Some(node) = pending.pop() {
        let mut cursor = node.walk();
        pending.extend(node.named_children(&mut cursor));
        if node.kind() != "call_expression" {
            continue;
        }
        let Some(function) = node.child_by_field_name("function") else {
            continue;
        };
        let selected = if callees.is_empty() {
            None
        } else {
            let target = function
                .utf8_text(source.as_bytes())?
                .split_whitespace()
                .collect::<String>();
            Some(callees.contains(&target))
        };
        if selected == Some(false) {
            continue;
        }
        let function = if function.kind() == "member_expression" {
            function.child_by_field_name("property")
        } else if function.kind() == "identifier" {
            Some(function)
        } else {
            None
        };
        let Some(function) = function else {
            continue;
        };
        if selected.is_none() && !["t", "tSync"].contains(&function.utf8_text(source.as_bytes())?) {
            continue;
        }
        let Some(arguments) = node.child_by_field_name("arguments") else {
            continue;
        };
        let mut argument_cursor = arguments.walk();
        let Some(argument) = arguments
            .named_children(&mut argument_cursor)
            .find(|child| child.kind() != "comment")
        else {
            continue;
        };
        if !["string", "template_string"].contains(&argument.kind()) {
            dynamic.insert(node.start_position().row + 1);
            continue;
        }
        let mut cursor = argument.walk();
        if argument
            .named_children(&mut cursor)
            .any(|child| child.kind() == "template_substitution")
        {
            dynamic.insert(node.start_position().row + 1);
            continue;
        }
        let key = decode_literal(argument.utf8_text(source.as_bytes())?)?;
        if !key.is_empty() {
            output.insert((key, node.start_position().row + 1));
        }
    }
    Ok(Scan {
        keys: output.into_iter().collect(),
        dynamic: dynamic.into_iter().collect(),
    })
}

pub fn run(args: ExtractArgs) -> Result<u8> {
    let project = args
        .project
        .as_ref()
        .map(|path| Project::load(path))
        .transpose()?;
    let config = args
        .config
        .as_ref()
        .map(|path| {
            crate::customer::settings_config(project.as_ref().map(|project| &project.config), path)
        })
        .transpose()?;
    let selected_config = config
        .as_ref()
        .or_else(|| project.as_ref().map(|project| &project.config));
    let policy = selected_config
        .map(|config| policy(config, "extract", args.policy.as_deref()))
        .transpose()?
        .unwrap_or_else(|| json!({}));
    if args.policy.is_some() && selected_config.is_none() {
        anyhow::bail!("--policy requires --config or --project.");
    }
    let extensions = if !args.extensions.is_empty() {
        args.extensions
    } else {
        policy
            .get("extensions")
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_else(|| {
                DEFAULT_EXTENSIONS
                    .iter()
                    .map(|value| (*value).to_owned())
                    .collect()
            })
    };
    let extensions = extensions
        .iter()
        .map(|extension| extension.trim_start_matches('.'))
        .collect::<BTreeSet<_>>();
    let exclude = if !args.exclude.is_empty() {
        args.exclude
    } else {
        policy
            .get("exclude")
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default()
    };
    let input = crate::config::absolute_path(&args.input)?;
    let mut files = Vec::new();
    collect_files(&input, &mut files)?;
    files.retain(|file| {
        file.extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extensions.contains(extension))
            && !exclude.iter().any(|pattern| {
                glob_matches(pattern, &file.to_string_lossy().replace('\\', "/"))
                    || file.to_string_lossy().contains(pattern)
            })
    });
    let mut occurrences: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    let callees = if args.callee.is_empty() {
        policy
            .get("callees")
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default()
    } else {
        args.callee
    };
    let mut dynamic_calls = Vec::new();
    for file in &files {
        let scan = scan(
            &fs::read_to_string(file)?,
            file.extension()
                .and_then(|extension| extension.to_str())
                .unwrap_or("js"),
            &callees,
        )
        .with_context(|| format!("Cannot extract {}.", file.display()))?;
        for line in scan.dynamic {
            dynamic_calls.push(json!({"file":file,"line":line}));
        }
        for (key, line) in scan.keys {
            occurrences
                .entry(key)
                .or_default()
                .push(json!({"file":file,"line":line}));
        }
    }
    let keys = occurrences.keys().cloned().collect::<BTreeSet<_>>();
    let project_keys = project
        .as_ref()
        .map(|project| project.keys())
        .transpose()?
        .map(|keys| keys.into_iter().collect::<BTreeSet<_>>());
    let missing = project_keys
        .as_ref()
        .map(|project| keys.difference(project).cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    let unused = project_keys
        .as_ref()
        .map(|project| project.difference(&keys).cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    let matched = keys
        .iter()
        .filter(|key| {
            project_keys
                .as_ref()
                .is_none_or(|project| project.contains(*key))
        })
        .cloned()
        .collect::<Vec<_>>();
    let configured_threshold = policy
        .get("failOn")
        .map(|value| {
            let name = value
                .as_str()
                .context("Extraction failOn must be a string.")?;
            FailOn::from_str(name, true).map_err(|error| anyhow::anyhow!(error))
        })
        .transpose()?;
    let fail_on = args
        .fail_on
        .or(configured_threshold)
        .unwrap_or(FailOn::None);
    let failed = match fail_on {
        FailOn::None => false,
        FailOn::Missing => !missing.is_empty(),
        FailOn::Unused => !unused.is_empty(),
        FailOn::Any => !missing.is_empty() || !unused.is_empty() || !dynamic_calls.is_empty(),
        FailOn::Dynamic => !dynamic_calls.is_empty(),
    };
    let payload = json!({"scannedFiles":files,"keys":keys,"matchedKeys":matched,"missingKeys":missing,"unusedProjectKeys":unused,"occurrences":occurrences,"dynamicCalls":dynamic_calls,"shouldFail":failed});
    report(
        &payload,
        &ArtifactArgs {
            config_file: args.input,
            output: args.output,
            no_summary: args.no_summary,
            no_metadata: false,
            format: args.format,
        },
        serde_json::to_string_pretty(&payload)?,
    )?;
    Ok(u8::from(failed))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn explicit_callees_exclude_unrelated_helpers_and_report_dynamic_calls() {
        let result = scan("other.t('false.positive'); lingva.t('real');\nlingva.t(key); lingva.t(`dynamic.${name}`);", "ts", &["lingva.t".into()]).unwrap();
        assert_eq!(result.keys, vec![("real".into(), 1)]);
        assert_eq!(result.dynamic, vec![2]);
    }
    #[test]
    fn only_literal_translation_calls_are_keys() {
        assert_eq!(
            keys(
                "// t('comment')\nconst fake = \"t('string')\";\n/* t('block') */\nclient.t('a.b', {x: 1}); tSync(`plain`); t(`dynamic.${x}`); t('prefix' + name); unrelated('no');", "ts"
            ).unwrap(),
            vec![("a.b".into(), 4), ("plain".into(), 4)]
        );
    }
    #[test]
    fn glob_metacharacters_are_not_regex() {
        assert!(glob_matches("*.project.json", "a.project.json"));
        assert!(!glob_matches("*.project.json", "a-project-json"));
        assert!(glob_matches("a?c*", "abc123"));
        assert!(!glob_matches("a?c", "ac"));
    }
    #[test]
    fn parser_ignores_regex_jsx_text_and_decodes_escaped_keys() {
        let source = r#"const pattern = /t('fake')/; const view = <p>t('not.code'){client.t('real')}</p>; t('\u0061.\x62'); t(`plain`); t(`dynamic.${x}`);"#;
        assert_eq!(
            keys(source, "tsx").unwrap(),
            vec![("a.b".into(), 1), ("plain".into(), 1), ("real".into(), 1)]
        );
        assert!(keys("const =", "ts").is_err());
    }
}
