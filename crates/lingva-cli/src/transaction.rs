//! Recoverable translation batches. A durable undo journal precedes any rename.
//!
//! Writers serialize per project directory. Ordinary failures restore old bytes;
//! after process termination, the next config load restores an unfinished batch.
//! The journal is private because translations may contain unpublished content.

use anyhow::{Context, Result, bail};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

const JOURNAL: &str = "translation-transaction.json";
const LOCK: &str = "translation-transaction.lock";

#[derive(Serialize, Deserialize)]
struct Previous {
    path: PathBuf,
    bytes: Option<Vec<u8>>,
}

fn directory(config: &Path) -> PathBuf {
    config.parent().unwrap_or(Path::new(".")).join(".lingva")
}

fn lock(directory: &Path) -> Result<fs::File> {
    fs::create_dir_all(directory)?;
    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(directory.join(LOCK))?;
    file.lock_exclusive()?;
    Ok(file)
}

fn restore(directory: &Path) -> Result<()> {
    let journal = directory.join(JOURNAL);
    if !journal.exists() {
        return Ok(());
    }
    let previous: Vec<Previous> = serde_json::from_slice(&fs::read(&journal)?)
        .context("Invalid translation transaction journal; preserve it for recovery.")?;
    for entry in previous {
        if let Some(bytes) = entry.bytes {
            crate::atomic_file::write(&entry.path, bytes, false)?;
        } else if entry.path.exists() {
            fs::remove_file(&entry.path)?;
            #[cfg(unix)]
            if let Some(parent) = entry.path.parent() {
                fs::File::open(parent)?.sync_all()?;
            }
        }
    }
    remove_journal(directory)
}

fn remove_journal(directory: &Path) -> Result<()> {
    fs::remove_file(directory.join(JOURNAL))?;
    #[cfg(unix)]
    fs::File::open(directory)?.sync_all()?;
    Ok(())
}

pub fn recover(config: &Path) -> Result<()> {
    let directory = directory(config);
    // A clean read-only command creates no transaction state. If a writer is
    // active, its lock blocks recovery until it has committed or terminated.
    if directory.join(JOURNAL).exists() {
        let _lock = lock(&directory)?;
        restore(&directory)?;
    }
    Ok(())
}

pub fn write(config: &Path, updates: Vec<(PathBuf, Vec<u8>)>) -> Result<()> {
    write_private(config, updates, &[])
}

pub fn write_private(
    config: &Path,
    updates: Vec<(PathBuf, Vec<u8>)>,
    private: &[PathBuf],
) -> Result<()> {
    write_with(config, updates, private, |_, _| Ok(()))
}

fn write_with(
    config: &Path,
    updates: Vec<(PathBuf, Vec<u8>)>,
    private: &[PathBuf],
    before_write: impl Fn(usize, &Path) -> Result<()>,
) -> Result<()> {
    if updates.is_empty() {
        return Ok(());
    }
    let directory = directory(config);
    let _lock = lock(&directory)?;
    restore(&directory)?;
    let mut previous = Vec::new();
    for (path, _) in &updates {
        if previous.iter().any(|entry: &Previous| entry.path == *path) {
            bail!(
                "Translation batch contains duplicate destination {}.",
                path.display()
            );
        }
        let bytes = match fs::symlink_metadata(path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                Some(fs::read(path)?)
            }
            Ok(_) => bail!(
                "Translation destination must be a regular file: {}.",
                path.display()
            ),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(error.into()),
        };
        previous.push(Previous {
            path: path.clone(),
            bytes,
        });
    }
    crate::atomic_file::write(
        &directory.join(JOURNAL),
        serde_json::to_vec(&previous)?,
        true,
    )?;
    for (index, (path, bytes)) in updates.iter().enumerate() {
        if let Err(error) = before_write(index, path)
            .and_then(|_| crate::atomic_file::write(path, bytes, private.contains(path)))
        {
            restore(&directory).context("Translation rollback failed; journal retained. Retry after restoring filesystem access.")?;
            return Err(error);
        }
    }
    // Removing and syncing the undo journal is the batch's commit point.
    remove_journal(&directory)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovery_waits_for_active_writer_and_never_undoes_its_commit() {
        use std::{sync::mpsc, thread, time::Duration};
        let root = tempfile::tempdir().unwrap();
        let config = root.path().join("config.yaml");
        let path = root.path().join("en.json");
        let (ready, waiting) = mpsc::channel();
        let (release, resumed) = mpsc::channel();
        let writer_config = config.clone();
        let writer_path = path.clone();
        let writer = thread::spawn(move || {
            write_with(
                &writer_config,
                vec![(writer_path, b"committed".to_vec())],
                &[],
                |_, _| {
                    ready.send(()).unwrap();
                    resumed.recv().unwrap();
                    Ok(())
                },
            )
            .unwrap()
        });
        waiting.recv_timeout(Duration::from_secs(5)).unwrap();
        let (finished, done) = mpsc::channel();
        let reader = thread::spawn(move || {
            recover(&config).unwrap();
            finished.send(()).unwrap();
        });
        assert!(done.recv_timeout(Duration::from_millis(50)).is_err());
        release.send(()).unwrap();
        writer.join().unwrap();
        reader.join().unwrap();
        assert_eq!(fs::read(path).unwrap(), b"committed");
    }

    #[test]
    fn failed_rollback_retains_journal_until_filesystem_is_repaired() {
        let root = tempfile::tempdir().unwrap();
        let config = root.path().join("config.yaml");
        let path = root.path().join("en.json");
        fs::write(&path, "old").unwrap();
        let result = write_with(
            &config,
            vec![
                (path.clone(), b"new".to_vec()),
                (root.path().join("ru.json"), b"new".to_vec()),
            ],
            &[],
            |index, _| {
                if index == 1 {
                    fs::remove_file(&path)?;
                    fs::create_dir(&path)?;
                    bail!("injected destination failure");
                }
                Ok(())
            },
        );
        assert!(result.unwrap_err().to_string().contains("rollback failed"));
        assert!(directory(&config).join(JOURNAL).is_file());
        fs::remove_dir(&path).unwrap();
        recover(&config).unwrap();
        assert_eq!(fs::read(path).unwrap(), b"old");
    }

    #[test]
    fn duplicate_destinations_and_corrupt_journals_fail_closed() {
        let root = tempfile::tempdir().unwrap();
        let config = root.path().join("config.yaml");
        let path = root.path().join("en.json");
        assert!(
            write(
                &config,
                vec![
                    (path.clone(), b"one".to_vec()),
                    (path.clone(), b"two".to_vec())
                ]
            )
            .is_err()
        );
        assert!(!path.exists());
        fs::write(directory(&config).join(JOURNAL), "corrupt").unwrap();
        assert!(recover(&config).is_err());
        assert_eq!(
            fs::read(directory(&config).join(JOURNAL)).unwrap(),
            b"corrupt"
        );
    }

    #[test]
    fn failure_restores_existing_files_and_removes_new_files() {
        let root = tempfile::tempdir().unwrap();
        let config = root.path().join("lingva.config.yaml");
        let old = root.path().join("en.json");
        let new = root.path().join("ru.json");
        fs::write(&old, "old").unwrap();
        let updates = vec![
            (old.clone(), b"new".to_vec()),
            (new.clone(), b"new".to_vec()),
            (root.path().join("fr.json"), b"new".to_vec()),
        ];
        let result = write_with(&config, updates, &[], |index, _| {
            if index == 2 {
                bail!("injected disk failure");
            }
            Ok(())
        });
        assert!(result.is_err());
        assert_eq!(fs::read(&old).unwrap(), b"old");
        assert!(!new.exists());
        assert!(!directory(&config).join(JOURNAL).exists());
    }

    #[test]
    fn interrupted_batch_is_recovered_before_next_config_read() {
        let root = tempfile::tempdir().unwrap();
        let config = root.path().join("lingva.config.yaml");
        let path = root.path().join("en.json");
        let previous = vec![Previous {
            path: path.clone(),
            bytes: Some(b"old".to_vec()),
        }];
        crate::atomic_file::write(
            &directory(&config).join(JOURNAL),
            serde_json::to_vec(&previous).unwrap(),
            true,
        )
        .unwrap();
        fs::write(&path, "partial").unwrap();
        recover(&config).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"old");
        recover(&config).unwrap();
    }

    #[test]
    fn invalid_later_destination_never_modifies_earlier_file() {
        let root = tempfile::tempdir().unwrap();
        let old = root.path().join("en.json");
        fs::write(&old, "old").unwrap();
        assert!(
            write(
                &root.path().join("config.yaml"),
                vec![
                    (old.clone(), b"new".to_vec()),
                    (root.path().to_owned(), b"invalid".to_vec())
                ]
            )
            .is_err()
        );
        assert_eq!(fs::read(old).unwrap(), b"old");
    }
}
