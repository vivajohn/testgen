import { Filer } from "./common/filer";
import { Parser } from './parser/tsparser';

console.log('START');

// const filer = new Filer('C:/tests/castclientcopy/src/app');
const filer = new Filer('./testinput/src');
const parser = new Parser();
parser.run(filer);

console.log('END');
