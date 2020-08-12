import { Node, SyntaxKind, Identifier, ImportDeclaration, StringLiteral, ImportSpecifier, TypeReferenceNode, SourceFile, PropertyAccessExpression, ArrayTypeNode } from 'typescript';
import { XProperty, XNode } from './xclasses';

export class Util {

  // Get the name of the node (varies by type of node)
  static getName(node: Node): string {
    if (node['text']) {
      return node['text'];
    }
    if (node['name']) {
      return (node['name'] as Identifier).text;
    }
    if (node.kind && node.kind === SyntaxKind.ThisKeyword) {
      return 'this';
    }
    if (node.kind && node.kind === SyntaxKind.Constructor) {
      return 'constructor';
    }
    return null;
  }

  // static getValue(node: Node): string {
  //   if (SyntaxKind[node.kind].includes('String')) {
  //     return `'${Util.getName(node)}'`;
  //   }
  //   const val = Util.getName(node);
  //   return val ? val : 'null';
  // }

  // Search the node and its descendents for import statements
  static getImportFroms(node: Node): any {
    const result = [];
    const froms = Util.findAll(node, SyntaxKind.ImportDeclaration);
    froms.forEach((imp: ImportDeclaration) => {
      const path = (imp.moduleSpecifier as StringLiteral).text;
      imp.importClause.namedBindings.forEachChild((child: ImportSpecifier) => {
        const name = child.name.text;
        result[name] = path;
      });
    });
    return result;
  }

  // Search the node and its descendents for the given id
  static findById(node: Node, id: string): Node {
    if (this.getName(node) === id) {
      return node;
    }
    
    let result: Node = null;
    node.forEachChild(child => {
      const n = this.findById(child, id);
      if (n) {
        result = n;
      }

    });
    return result;
  }

  // Return the parent node of the target node
  static getParent(source: Node, target: Node): Node {
    let match: Node = null;
    source.forEachChild(child => {
      if (!match) {
        if (child === target) {
          match = source;
        } else {
          match = this.getParent(child, target);
        }
      }
    });
    return match;
  }

  // Search for a node of a given kind and id
  static find(node: Node, kind: SyntaxKind, id: string): Node {
    if (node.kind === kind && this.getName(node) === id) {
      return node;
    }
    let result: Node = null;
    node.forEachChild(child => {
      const n = Util.find(child, kind, id);
      if (n) {
        result = n;
      }
    });
    return result;
  }

  // Search for a kind of statement which might not be present.
  // Returns null when not present.
  static findOne(node: Node, kind: SyntaxKind): Node {
    const result = Util.findAll(node, kind);
    return result.length > 0 ? result[0] : null;
  }
  
  // Search the node and its descendents for given kind of statement
  static findAll(node: Node, kind: SyntaxKind): Node[] {
    let nodes: Node[] = [];
    if (node.kind === kind) {
      nodes.push(node);
    }
    node.forEachChild(child => {
      nodes = [...nodes, ...this.findAll(child, kind)];
    });
    return nodes;
  }

  // Find the names of properties in the refsTo node which are actually used 
  static getPropAccess(node: Node, refsTo: Node): PropertyAccessExpression[] {
    // const props = <PropertyAccessExpression[]>Util.findAll(node, SyntaxKind.PropertyAccessExpression);
    const props = this.findPropAccess(node);
    const id = this.getName(refsTo);
    const names = {};
    props.forEach(prop => {
      const child = this.findById(prop, id);
      const name = Util.getName(prop);
      if (child && !names[name]) {
        names[name] = prop;
      }
    });
    return Object.values(names);
  }

  // Search the node and its children for property access expression
  // NOTE: recursive
  static findPropAccess(node: Node): PropertyAccessExpression[] {
    // PropertyAccessExpressions can be nested: we want only the top ones
    if (node.kind === SyntaxKind.PropertyAccessExpression) {
      return [node as PropertyAccessExpression];
    }
    let nodes: PropertyAccessExpression[] = [];
    node.forEachChild(child => {
      if (child.kind === SyntaxKind.PropertyAccessExpression) {
        nodes.push(child as PropertyAccessExpression);
      } else {
        nodes = [...nodes, ...this.findPropAccess(child)];
      }
    });
    return nodes;
  }


  // Find the type of the object. If it is not a base type, then this finds
  // the name of the class.
  static findType(node: Node, parent: XNode, source: SourceFile): XProperty {
    let param = new XProperty(node, parent);
    param.node = node;
    let basicType = this.basicType(node);
    if (!basicType) {
      if (node['initializer']) {
        let init = node['initializer'];
        basicType = this.basicType(init);
        if (!basicType) {
          if (init['name']) {
            // property accessor
            const name = Util.getName(init);
            init = Util.find(source, SyntaxKind.PropertyDeclaration, name);
          }
          basicType = this.findType(init, parent, source).type;
        }
      }
    }
    param.type = basicType;
    if (param.type) {
      param.isLiteral = true;
      param.typeName = SyntaxKind[param.type];
    } else {
      let nodeType = node['type'];
      if (nodeType){
        if (nodeType.kind === SyntaxKind.ArrayType) {
          nodeType = (nodeType as ArrayTypeNode).elementType;
          param = this.findType(nodeType, parent, source);
          param.isArray = true;
        }
        param.type = nodeType.kind;
        if (nodeType.kind === SyntaxKind.TypeReference) {
          param.typeName = ((nodeType as TypeReferenceNode).typeName as Identifier).text;
        }
      }
      param.name = Util.getName(node);
    }
    return param;
  }

  // A number, a string in quotes or true/false
  static basicType(node: Node): SyntaxKind {
    switch(node.kind) {
      case SyntaxKind.NumberKeyword:
      case SyntaxKind.NumberKeyword:
      case SyntaxKind.NumericLiteral:
        return SyntaxKind.NumberKeyword;
      case SyntaxKind.StringLiteral:
      case SyntaxKind.StringKeyword:
        return SyntaxKind.StringKeyword;
      case SyntaxKind.TrueKeyword:
      case SyntaxKind.FalseKeyword:
        return SyntaxKind.BooleanKeyword;
    }
    return null;
  }

  // Get the text from the given source code position to the end of the
  // line. Used mainly for adding comments to the generated code.
  static stmtText(text: string, pos: number): string {
    text = text.substr(pos).trim();
    return text.split('\n')[0].trim();
    // return text.substr(0, 20).replace(/[\r\n]+/g, ' ');
  }

  // Debug method
  static dump(obj: any, indent: string = '') {
    Object.keys(obj).forEach(key => {
      // console.log(`${indent}${key}`);
      console.log(`${indent}${key}: ${obj[key]}`);
    });
  }

  // Debug method
  static dumpKind(obj: Node): string {
    return obj['kind'] ? `: ${SyntaxKind[obj.kind]}` : 'undefined';
  }

  // Debug method
  static dumpWith(message: string, obj: Node, source: SourceFile, indent: string = '') {
    const kind = obj['kind'] ? `: ${SyntaxKind[obj.kind]}` : '';
    console.log(`${indent}${message}${kind}`);
    console.log(`${indent}  ${this.stmtText(source.getText(), obj.pos)}`);
    Object.keys(obj).forEach(key => {
      console.log(`${indent}  ${key}: ${obj[key]}`);
    });
  }

}