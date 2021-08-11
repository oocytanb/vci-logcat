import { promises as fs } from 'fs';

interface PartialPackageJson {
  name: string;
  version: string;
}

const stringValue = (value: string) => {
  const s = JSON.stringify(value ?? '');
  return `'${s.substring(1, s.length - 1)}'`;
}

const packageInfoCode = async (fileName: string) => {
  const content = await fs.readFile(fileName, 'utf-8');
  const packageJson = JSON.parse(content) as PartialPackageJson;
  return `export const packageInfo = {
  name: ${stringValue(packageJson.name)},
  version: ${stringValue(packageJson.version)},
} as const;
`;
};

(async () => {
  const code = await packageInfoCode('package.json');
  await fs.writeFile('./src/lib/package_info.ts', code, 'utf-8');
})();
