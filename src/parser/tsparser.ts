import { SourceFile, ScriptTarget, ModuleKind, createProgram, Node, SyntaxKind, 
  MethodDeclaration, Block, Statement, IfStatement,
  SwitchStatement, ClassDeclaration,
  NodeArray,
  BinaryExpression,
  ConditionalExpression,
  CaseOrDefaultClause,
  isCaseClause,
  CaseClause} from "typescript";
import { basename } from 'path';
import { XNode, XMethod, XBlock, BaseType, XIf, XClass, XCondition, XSwitch, XProgram } from '../common/xclasses';
import { Filer } from '../common/filer';
import { Util } from '../common/util';
import { Generator } from '../generator/generator';
import { XModule } from '../common/xmodule';
import ts = require('typescript');

// Parses typescript code and creates test code from it
// TO DO: move code having to do with file i/o to filer class
export class Parser {

  private readonly options = {
    target: ScriptTarget.ES5,
    module: ModuleKind.CommonJS
  };

  // TO DO: move the visit* methods to their own class. Move this property with them,
  // and provide the source file as a parameter to the constructor.
  private source: SourceFile;

  private xprogram: XProgram = new XProgram(null, null);

  // Given a list of typescript files, parses them
  run(filer: Filer) {
    const parser = new Parser();
    const module = parser.processModules(filer);
    parser.parseTsFiles(filer, module);
  }

  // Read and parse all of the module file in order to build import and declaration lists
  private processModules(filer: Filer): XModule {
    const program = createProgram(filer.moduleFiles, this.options);
    const module = new XModule();

    filer.moduleFiles.forEach(path => {
      console.log('MODULE: ' + basename(path));
      const source = program.getSourceFile(path);

      module.buildImports(source);
      module.buildDeclarations(source);
    });

    return module;
  }

  // Read and parse all of the typescript files in the target project
  private dbug;
  private parseTsFiles(filer: Filer, module: XModule) {
    const program = createProgram(filer.codeFiles, this.options);
    this.dbug = program;
    filer.codeFiles.forEach(path => {
      console.log('FILE: ' + path);
      
      this.source = program.getSourceFile(path);

      const classes: XClass[] = [];

      Util.findAll(this.source, SyntaxKind.ClassDeclaration).forEach(node => {
        const xclass = this.visitClass(node as ClassDeclaration);
        classes.push(xclass);
        this.xprogram.classes.push(xclass)
      });

      classes.forEach(xclass => {
        const fileText = (new Generator()).create(xclass, module, this.source, path, filer.cwd);
        // console.log(`OUTPUT ${xclass.name}\n`, fileText);

        // *** DEBUG ***
        filer.writeNewFile(`C:/Projects/testgen/debug/${xclass.name}.testgen.ts`, fileText);
        // filer.writeNewFile(newPath, fileText);
      });
    });
  }

  // Parse a class
  private visitClass(node: ClassDeclaration): XClass {
    const xclass = new XClass(node, this.xprogram);
    xclass.name = Util.getName(node.name);
    xclass.construct = this.getConstructor(xclass);

    // Find class properties
    node.members.forEach(p => {
      if (p.kind === SyntaxKind.PropertyDeclaration) { // || p.kind === SyntaxKind.GetAccessor
        const param = Util.findType(p, xclass, this.source);
        param.isClassVar = true;
        xclass.properties.push(param);
      }
    });

    // Find methods
    // Note: constructor not included in this, but would need special treatment if it has branches
    Util.findAll(node, SyntaxKind.MethodDeclaration).forEach(node => {
      xclass.methods.push(this.visitMethod(node as MethodDeclaration, xclass));
    });

    console.log(`CLASS ${xclass.name}`, xclass);

    return xclass;
  }

  // Returns null if the class has no constructor
  private getConstructor(parent: XClass): XMethod {
    const clss = Util.find(this.source, SyntaxKind.ClassDeclaration, parent.name);
    const node = Util.findOne(clss, SyntaxKind.Constructor);
    return node ? this.visitMethod(node as MethodDeclaration, parent) : null;
  }

  // Parse a method
  // method ::= [ access_modifier ] Identifier [{ Parameter }] [ return_type ] Block
  private visitMethod(node: MethodDeclaration, parent: XNode): XMethod {
    // Util.dump(node, indent + '  ');
    const method = new XMethod(node, parent);
    method.name = Util.getName(node);
    console.log('METHOD: ' + method.name);
    method.codeblock = this.visitBlock(node.body, method);
    if (node.type) {
      const k = SyntaxKind[node.type.kind];
      if (k.includes('string')) {
        method.returns = BaseType.xstring;
      } else if (k.includes('number')) {
        method.returns = BaseType.xnumber;
      } else if (k.includes('bool')) {
        method.returns = BaseType.xboolean;
      } else {
        method.returns = BaseType.xobject;
      }
    }
    if (node.modifiers) {
      node.modifiers.forEach(m => {
        switch (m.kind) {
          case SyntaxKind.PublicKeyword:
            method.isPublic = true;
            break;
          case SyntaxKind.StaticKeyword:
            method.isStatic = true;
            break;
          case SyntaxKind.PrivateKeyword:
          case SyntaxKind.ProtectedKeyword:
            method.isPublic = false;
            break;
          default:
            console.log(`  * Untreated method modifier: ${SyntaxKind[m.kind]}`);
            break;
        }
      });
    }
    node.parameters.forEach(p => {
      const param = Util.findType(p, method, this.source);
      method.parameters.push(param);
    });

    method.codeblock = this.visitBlock(node.body, method);

    return method;
  }
  
  // Process a statement. In the context of this program, we are currently
  // only interested in conditional statements.
  private visitStatement(node: Node, parent: XNode): XIf {
    let xif: XIf = null;
    switch(node.kind) {
      case SyntaxKind.IfStatement: {
        xif = new XIf(node, parent);
        const ifStmt = node as IfStatement;
        // const iftext = Util.stmtText(this.source.getText(), ifStmt.pos);
        // Util.dumpWith(iftext, ifStmt, this.source, '  ');
        xif.conditions.push(this.visitIfExpression(ifStmt.expression, xif));

        // We are only intersted in if statements with blocks because we are looking for nested ifs
        // TO DO: what about "if(xxx) return val === 2 ? true : false;" Is this a statement or a block?
        if (ifStmt.thenStatement.kind === SyntaxKind.Block) {
          xif.ifBlock.push(this.visitBlock(ifStmt.thenStatement as Block, xif));
        }
        if (ifStmt.elseStatement && ifStmt.elseStatement.kind === SyntaxKind.Block) {
          xif.elseBlock = this.visitBlock(ifStmt.elseStatement as Block, xif);
        }
        break;
      }
      case SyntaxKind.SwitchStatement: {
        xif = new XSwitch(node, parent);
        const switchStmt = node as SwitchStatement;
        // Util.dumpWith('SwitchStatement', switchStmt, this.source, '  ');

        // The clauses are the cases. Each clause has an expression which is the case value.
        // The clause has an array of statements which are the code for the case.
        // If the clause is delimited by brackets, it has an array with 1 statement which is a block.
        // console.log('clauses', switchStmt.caseBlock.clauses);
        switchStmt.caseBlock.clauses.forEach((clause: CaseOrDefaultClause) => {
          if (isCaseClause(clause)) {
            const xc = new XCondition(switchStmt, parent);
            xc.left = switchStmt.expression;
            xc.operator = SyntaxKind.EqualsEqualsEqualsToken;
            xc.right = (<CaseClause>clause).expression;
            xif.conditions.push(xc);
          } else {
            // default clause - anything to do?
          }
          let block: XBlock;
          if (clause.statements[0].kind === SyntaxKind.Block) {
            block = this.visitBlock(clause.statements[0] as Block, xif)
          } else {
            block = new XBlock(null, xif);
            block.branches = this.visitStatements(clause.statements, xif);
          }
          xif.ifBlock.push(block);
        });
        break;
      }
      case SyntaxKind.ConditionalExpression:
        const qmark = node as ConditionalExpression;
        xif = new XIf(qmark, parent);
        xif.conditions.push(this.visitIfExpression(qmark.condition, xif));
        break;
      default:
        node.forEachChild(child => {
          if (!xif) {
            xif = this.visitStatement(child, parent);
          }
        });
        break;
    }
    return xif;
  }
  
  // Process a code block
  private visitBlock(node: Block, parent: XNode): XBlock {
    var block = new XBlock(node, parent);
    block.branches = this.visitStatements(node.statements, block);
    return block;
  }

  // Process a list of statements
  private visitStatements(nodes: NodeArray<Statement>, parent: XNode): XIf[] {
    let xifs: XIf[] = [];
    nodes.forEach(node => {
      if (node.kind === SyntaxKind.Block) {
        xifs = [...xifs, ...this.visitStatements((node as Block).statements, parent)];
      } else {
        const xif = this.visitStatement(node as Statement, parent);
        if (xif) {
          xifs.push(xif);
        }
      }
    });
    return xifs;
  }

  // Process a conditional statement
  private visitIfExpression(node: Node, parent: XNode): XCondition {
    const c = new XCondition(node, parent);
    // console.log(`  Expression: ${SyntaxKind[node.kind]}`);
    // Util.dump(node, '    ');
    if (node.kind === SyntaxKind.BinaryExpression) {
      const b = node as BinaryExpression;
      c.left = b.left;
      c.operator = b.operatorToken.kind;
      c.right = b.right;
    } else if (node.kind === SyntaxKind.Identifier) {
      // Unary condition
    } else {
      // console.log(`* Untreated expression: ${SyntaxKind[node.kind]}`);
    }
    return c;
  }

}