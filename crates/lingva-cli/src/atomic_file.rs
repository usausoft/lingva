//! Crash-safe single-file replacement for configs, translations, and secrets.
//!
//! Stage beside the destination, set permissions before writing secrets, sync,
//! then rename. A failed write cannot truncate the last committed file.

use anyhow::Result;
use std::{fs, io::Write, path::Path};

pub fn write(path: &Path, source: impl AsRef<[u8]>, private: bool) -> Result<()> {
    let directory = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(directory)?;
    let mut staging = tempfile::NamedTempFile::new_in(directory)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = if private {
            0o600
        } else {
            fs::metadata(path)
                .map(|metadata| metadata.permissions().mode() & 0o777)
                .unwrap_or(0o644)
        };
        staging
            .as_file()
            .set_permissions(fs::Permissions::from_mode(mode))?;
    }
    #[cfg(not(unix))]
    let _ = private;
    staging.write_all(source.as_ref())?;
    staging.as_file().sync_all()?;
    staging.persist(path).map_err(|error| error.error)?;
    #[cfg(unix)]
    fs::File::open(directory)?.sync_all()?;
    Ok(())
}
