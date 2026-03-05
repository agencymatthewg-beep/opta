---
id: 207
date: 2026-03-04
time: 20:31
author: matthewbyrden
version_before: 0.1.0
version_after: 0.1.0
commit: 562baae6
promoted: true
category: sync
---

## Summary
- opta update (auto) — cli, lmx, plus
- Steps: total=5, ok=1, skip=3, fail=1

## Command Inputs
- `components`: `["cli","lmx","plus"]`
- `dryRun`: `false`
- `json`: `false`
- `localAppsRoot`: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal`
- `mode`: `auto`
- `noBuild`: `false`
- `noPull`: `false`
- `remoteAppsRoot`: `/Users/Shared/312/Opta/1-Apps`
- `remoteHost`: `localhost`
- `remoteHostUsed`: `(none)`
- `targets`: `["local"]`

## Step Results
| Target | Component | Step | Status | Message |
| --- | --- | --- | --- | --- |
| local | cli | git | skip | dirty working tree (skipped pull) |
| local | cli | build | ok | npm typecheck + build complete |
| local | lmx | git | skip | dirty working tree (skipped pull) |
| local | lmx | build | fail | ERROR: File "setup.py" or "setup.cfg" not found. Directory cannot be installed in editable mode: /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1M-Opta-LMX (A "pyproject.toml" file was found, but editable mode currently requires a setuptools-based build.) WARNING: You are using pip version 21.2.4; however, version 26.0.1 is available. You should consider upgrading via the '/Applications/Xcode.app/Contents/Developer/usr/bin/python3 -m pip install --upgrade pip' command.   DEPRECATION: A future pip version will change local packages to be built in-place without first copying to a temporary directory. We recommend you use --use-feature=in-tree-build to test your packages with this new behavior before it becomes the default.    pip 21.3 will remove support for this functionality. You can find discussion regarding this at https://github.com/pypa/pip/issues/7555.   WARNING: Value for prefixed-purelib does not match. Please report this to <https://github.com/pypa/pip/issues/10151>   distutils: /private/var/folders/nr/1m_wfmcs5cn5qpnjkwbyg3bm0000gn/T/pip-build-env-0kyp6pv2/normal/lib/python3.9/site-packages   sysconfig: /Library/Python/3.9/site-packages   WARNING: Value for prefixed-platlib does not match. Please report this to <https://github.com/pypa/pip/issues/10151>   distutils: /private/var/folders/nr/1m_wfmcs5cn5qpnjkwbyg3bm0000gn/T/pip-build-env-0kyp6pv2/normal/lib/python3.9/site-packages   sysconfig: /Library/Python/3.9/site-packages   WARNING: Additional context:   user = False   home = None   root = None   prefix = '/private/var/folders/nr/1m_wfmcs5cn5qpnjkwbyg3bm0000gn/T/pip-build-env-0kyp6pv2/normal'   WARNING: Value for prefixed-purelib does not match. Please report this to <https://github.com/pypa/pip/issues/10151>   distutils: /private/var/folders/nr/1m_wfmcs5cn5qpnjkwbyg3bm0000gn/T/pip-build-env-0kyp6pv2/overlay/lib/python3.9/site-packages   sysconfig: /Library/Python/3.9/site-packages   WARNING: Value for prefixed-platlib does not match. Please report this to <https://github.com/pypa/pip/issues/10151>   distutils: /private/var/folders/nr/1m_wfmcs5cn5qpnjkwbyg3bm0000gn/T/pip-build-env-0kyp6pv2/overlay/lib/python3.9/site-packages   sysconfig: /Library/Python/3.9/site-packages   WARNING: Additional context:   user = False   home = None   root = None   prefix = '/private/var/folders/nr/1m_wfmcs5cn5qpnjkwbyg3bm0000gn/T/pip-build-env-0kyp6pv2/overlay' ERROR: Package 'opta-lmx' requires a different Python: 3.9.6 not in '>=3.12' WARNING: You are using pip version 21.2.4; however, version 26.0.1 is available. You should consider upgrading via the '/Applications/Xcode.app/Contents/Developer/usr/bin/python3 -m pip install --upgrade pip' command. |
| local | plus | git | skip | repo missing: /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1I-OptaPlus |
