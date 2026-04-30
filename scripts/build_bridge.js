const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

function pythonCandidates() {
  if (process.platform === 'win32') {
    return [
      path.join(rootDir, '.venv', 'Scripts', 'python.exe'),
      path.join(rootDir, '.venv', 'Scripts', 'python3.exe'),
    ];
  }
  return [
    path.join(rootDir, '.venv', 'bin', 'python3'),
    path.join(rootDir, '.venv', 'bin', 'python'),
  ];
}

function findPython() {
  for (const candidate of pythonCandidates()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('未找到可用的 .venv Python，请先运行 ./scripts/setup_python.sh');
}

function run() {
  const python = findPython();
  const distDir = path.join(rootDir, 'bridge-dist');
  const buildDir = path.join(rootDir, 'bridge-build');

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.rmSync(buildDir, { recursive: true, force: true });

  const args = [
    '-m', 'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onefile',
    path.join(rootDir, 'python', 'bridge.py'),
    '--name', 'ohmypaper-bridge',
    '--hidden-import', 'deepxiv_sdk.cli',
    '--hidden-import', 'deepxiv_sdk.reader',
    '--hidden-import', 'click',
    '--hidden-import', 'requests',
    '--hidden-import', 'dotenv',
    '--hidden-import', 'pypdf',
    '--distpath', distDir,
    '--workpath', path.join(buildDir, 'work'),
    '--specpath', path.join(buildDir, 'spec'),
  ];

  const result = spawnSync(python, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      PYTHONNOUSERSITE: '1',
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run();
