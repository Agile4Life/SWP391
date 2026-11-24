// Mục đích: luôn chạy Maven Wrapper đúng phiên bản của dự án, bất kể thư mục gọi lệnh, để build/test API nhất quán.
import { spawnSync } from 'node:child_process';

// Luôn sử dụng Maven Wrapper đúng phiên bản của dự án, bất kể thư mục gọi lệnh.
const result = spawnSync(
  process.platform === 'win32' ? 'mvnw.cmd' : './mvnw',
  process.argv.slice(2),
  {
    cwd: new URL('../apps/api/', import.meta.url),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (result.error) {
  console.error(`Cannot start Maven Wrapper: ${result.error.message}`);
}
process.exit(result.status ?? 1);
