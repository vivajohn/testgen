import { readdirSync, lstatSync, writeFileSync } from 'file-system';
import { join } from 'path';

// File i/o related functionality
export class Filer {

  moduleFiles: string[] = [];
  codeFiles: string[] = [];
  cwd: string;

  constructor(directoryPath: string) {
    // Searches a directory for all of the module and code files
    this.cwd = directoryPath;
    this.addFiles(directoryPath);
  }

  private addFiles(dirPath: string) {
    const files = readdirSync(dirPath);
    files.forEach(file => {
      var path = join(dirPath, file);
      var stat = lstatSync(path);
      if (stat.isDirectory()) {
        this.addFiles(path);
      } else if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) {
        if (path.includes('.module.')) {
          this.moduleFiles.push(path);
        } else {
          this.codeFiles.push(path);
        }
      }
    });
  }

  writeNewFile(path: string, content: string) {
    writeFileSync(path, content);
  }
}