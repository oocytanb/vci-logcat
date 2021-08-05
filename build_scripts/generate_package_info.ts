import { promises as fs } from 'fs';

interface PartialPackageJson {
  name: string;
  version: string;
}

const string_value = (value: string) => {
  const s = JSON.stringify(value ?? '');
  return `'${s.substring(1, s.length - 1)}'`;
}

const package_info_code = async (file_name: string) => {
  const content = await fs.readFile(file_name, 'utf-8');
  const package_json = JSON.parse(content) as PartialPackageJson;
  return `export const packageInfo = {
  name: ${string_value(package_json.name)},
  version: ${string_value(package_json.version)},
} as const;
`;
};

(async () => {
  const code = await package_info_code('package.json');
  await fs.writeFile('./src/lib/package_info.ts', code, 'utf-8');
})();
