import { Node, SyntaxKind, SourceFile, ImportDeclaration, StringLiteral, ImportSpecifier, PropertyAssignment, Identifier, ArrayLiteralExpression } from 'typescript';
import { Util } from './util';

// Parses module files to make lists of imports and declarations
// TO DO: make a constructor which takes a list of file paths and loops over
// them to build the imports and declarations list
export class XModule {

  // import-from statements: (name, path) pair
  importFrom = {
    TestBed: '@angular/core/testing',
    ComponentFixture: '@angular/core/testing',
    async: '@angular/core/testing',
    NoopAnimationsModule: '@angular/platform-browser/animations',
    RouterTestingModule: '@angular/router/testing'
  }; 

  // import-from statements for items in the declarations section
  declareImportFrom = {};

  // entries in the imports section of the module declaration
  imported: string[] = [
    'NoopAnimationsModule',
    'RouterTestingModule'
  ];

  // entries in the imports section of the module declaration
  declareImported: string[] = [];

  // entries in the declarations section of the module declaration
  declarations: string[] = [];


  buildImports(source: SourceFile) {
    // Get the items listed in the imports section of the module declaration
    const prop: PropertyAssignment = <PropertyAssignment>Util.find(source, SyntaxKind.PropertyAssignment, 'imports');
    const names = (prop.initializer as ArrayLiteralExpression).elements.map((i: Identifier) => i.text);
    // console.log(`names, len=${names.length}`, names);
    this.imported = [...this.imported, ...names.filter(name => !this.imported.includes(name))];
    
    // Get the import-from statements for the above items
    const from = Util.getImportFroms(source);
    Object.keys(from).forEach(name => {
      if (this.imported.includes(name) && !this.importFrom[name]) {
        this.importFrom[name] = from[name];
      }
    });
    // console.log(`include, len=${Object.values(this.importFrom).length}`, this.importFrom);
  }

  buildDeclarations(source: SourceFile) {
    // Get the items listed in the declarations section of the module declaration
    const prop: PropertyAssignment = <PropertyAssignment>Util.find(source, SyntaxKind.PropertyAssignment, 'declarations');
    const names = (prop.initializer as ArrayLiteralExpression).elements.map((i: Identifier) => i.text);
    // console.log(`names, len=${names.length}`, names);
    this.declarations = [...this.declarations, ...names.filter(name => !this.declarations.includes(name))];
    
    // Get the import-from statements for the above items
    const from = Util.getImportFroms(source);
    Object.keys(from).forEach(name => {
      if (this.declarations.includes(name) && !this.declareImportFrom[name]) {
        this.declareImportFrom[name] = from[name];
      }
    });
  }

}