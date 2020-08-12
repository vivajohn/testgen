import { XProperty, XCondition, XMethod, XClass, XIf } from '../common/xclasses';
import { SyntaxKind, SourceFile, Node } from 'typescript';
import { Util } from '../common/util';

// Various methods to generate fake data
export class DataFaker {

  // A set of fake values to be used to visit all of the conditions
  callValues(xc: XCondition, source: SourceFile): string[] {
    if (xc.left && xc.right) {
      const item = this.getLiteral(xc, xc.parent as XIf, source);
      if (item.isLiteral) {
        const value = this.getValue(item.right);
        return [ value, this.invertValue(item.right, value, xc)];
      } else {
        return [this.makeValue(item.left), this.makeNotValue(item.left)];
      }
    }

    // if (!xc.left) {
    //   // Unary condition
    // }

    return ['true', 'false'];
  }

  // Looks for a literal value in the condition and returns it in the 'right' property if found
  getLiteral(xc: XCondition, branch: XIf, source: SourceFile): { left: XProperty, right: XProperty, isLiteral: boolean } {
    const prop1 = Util.findType(xc.left, branch, source);
    const prop2 = Util.findType(xc.right, branch, source);
    if (prop2.isLiteral) {
      return { left: prop1, right: prop2, isLiteral: true };
    }
    if (prop1.isLiteral) {
      return { left: prop2, right: prop1, isLiteral: true };
    }
    return { left: prop2, right: prop1, isLiteral: false };
  }

  // Get a literal value from a node
  private getValue(prop: XProperty): string {
    const node = prop.node;
    if (SyntaxKind[node.kind].includes('String')) {
      return `'${Util.getName(node)}'`;
    }
    const val = Util.getName(node);
    return val ? val : 'null';
  }

  private invertValue(prop: XProperty, value: any, xc: XCondition): string {
    // TO DO: return value according to condition
    if (prop.isArray) {
      return this.makeNotValue(prop);
    }
    switch(prop.type) {
      case SyntaxKind.NumberKeyword:
        return `'${(value as number)++}'`;
      case SyntaxKind.BooleanKeyword:
        return `'${!(value as boolean)}'`;
      case SyntaxKind.StringKeyword:
        const str = (value as string).replace(`'`, '');
        return `'not_${str}`
    }
    return null;
  }
  
  makeValue(prop: XProperty): string {
    switch(prop.type) {
      case SyntaxKind.NumberKeyword:
        return prop.isArray ? '[3, 4, 5]' : '2';
      case SyntaxKind.BooleanKeyword:
        return prop.isArray ? '[false, true]' : 'true';
      case SyntaxKind.StringKeyword:
        return prop.isArray ? `['de', 'fg']` : `'abc'`;
    }
    if (prop.typeName === 'File') {
      return `new File(['fakedata'], 'fakefilename')`;
    }
    return prop.isArray ? `[null, null]` : 'null';
  }
  
  makeNotValue(prop: XProperty): any {
    switch(prop.type) {
      case SyntaxKind.NumberKeyword:
        return prop.isArray ? '[]' : 0;
      case SyntaxKind.BooleanKeyword:
        return prop.isArray ? '[false, false]' : false;
      case SyntaxKind.StringKeyword:
        return prop.isArray ? `[]` : `null`;
    }
    if (prop.typeName === 'File') {
      return `new File(['fakedata'], 'fakefilename')`;
    }
    return prop.isArray ? `[null, null]` : 'null';
  }

  makeObject(names: string[], value: string, obj: any = {}): any {
    names.shift();
    if (names.length === 1) {
      obj[names[0]] = value;
    } else {
      const name = names[0];
      obj[name] = this.makeObject(names, value);
    }
    return obj;
  }

}