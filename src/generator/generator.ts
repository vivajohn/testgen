import { XClass, XMethod, XIf, XBlock, XCondition, XProperty, XNode } from '../common/xclasses';
import { SourceFile, SyntaxKind, isIdentifier, Node, isToken, MethodDeclaration, CallExpression } from 'typescript';
import { Util } from '../common/util';
import { XModule } from '../common/xmodule';
import { parse, relative } from 'path';
import { DataFaker } from './data-faker';
import { GenText, Lines, Line } from './gentext';
import { GenMethod } from './genmethod';

// Generates test code for a class
export class Generator {
  private xclass: XClass;
  private source: SourceFile;
  private stubException = ['DomSanitizer'];
  private faker = new DataFaker();
  private fakes: {[s: string]: XProperty} = {};
  private injected: {[s: string]: XProperty} = {};
  private liner = new Lines();
  
  create(xclass: XClass, module: XModule, source: SourceFile, filePath: string, cwd: string): string {
    this.xclass = xclass;
    this.source = source;
    this.findStubs();
    this.liner.pushBlank();
    this.makeImports(module, filePath, cwd);
    this.liner.pushBlank();
    this.makeStubs();
    this.makeDescribe(module, this.liner)
    return GenText.generate(this.liner.list, 0);
  }

  private makeImports(module: XModule, filePath: string, cwd: string) {
    // Get the import-from statements for the above items
    const all = Object.assign({}, module.importFrom);
    const froms = Util.getImportFroms(this.source);
    Object.keys(froms).forEach(name => {
      if (!all[name]) {
        all[name] = froms[name];
      }
    });
    all[this.xclass.name] = './' + parse(filePath).name;

    Object.keys(all).forEach(name => {
      this.liner.push(`import { ${name} } from '${all[name]}';`);
    });

    const d = Object.assign({}, module.declareImportFrom);
    Object.keys(d).forEach(name => {
      if (!all[name]) {
        const path = parse(filePath);
        const to = parse(d[name] + '.ts');
        to.dir = cwd + '/' + to.dir.replace('./', '');
        let relPath = relative(path.dir, to.dir);
        // console.log(`${cwd.dir} -> ${to.dir}: ${relPath}`)
        relPath = `${relPath.replace(/\\/g, "/")}/${to.name}`;
        if (!relPath.startsWith('.')) {
          relPath = './' + relPath;
        }
        // console.log(`  ${relPath}`);
        this.liner.push(`import { ${name} } from '${relPath}';`);
      }
    })

    return all;
  }

  // Find the services and objects which need a fake class
  private findStubs() {
    this.propsToStubs(this.xclass.properties, this.fakes);
    const method = this.xclass.construct;
    if (method) {
      this.propsToStubs(method.parameters, this.injected);
    }
  }

  private propsToStubs(props: XProperty[], outObj) {
    props.filter(x => x.typeName && !this.stubException.includes(x.typeName))
      .forEach(p => outObj[p.typeName] = p);
  }

  // Makes a stub for unknown types
  // Limit to just the arguments of the constructor?
  private makeStubs() {
    Object.values(this.fakes).forEach(p => this.outputStub(p, 'Fake'));
    Object.values(this.injected).forEach(p => this.outputStub(p, 'Stub'));
  }

  // Generate stub code
  private outputStub(stubMe: XProperty, prefix: string) {
    this.liner.pushBlank();
    this.liner.pushBlockFn(`class ${prefix}${stubMe.typeName} `, (liner: Lines) => {
      // Find out which properties of this class are being used in the current code file
      const props = Util.getPropAccess(this.source, stubMe.node);
      props.forEach(x => {
        const name = Util.getName(x);
        const parent = Util.getParent(this.source, x);
        if (parent.kind === SyntaxKind.CallExpression) {
          const args = (parent as CallExpression).arguments;
          let argList = '';
          if (args) {
            const a: string[] = [];
            for (let i = 1; i <= args.length; i++) a.push(`arg${i}: any`)
            argList = a.join(', ');
          }
          liner.pushBlockFn(`${name}(${argList}): any `, (liner: Lines) => {
            liner.push(`return null;`);
          });
        } else {
          liner.push(`${name}: any;`);
        }
      });
    });
  }

  // Generate the 'describe' section
  private makeDescribe(module: XModule, liner: Lines) {
    const isComponent = this.source.getText().includes('@Component');
    const services = Object.keys(this.injected);

    liner.pushBlank();
    liner.pushLambdaFn(`describe('${this.xclass.name}', `, (liner) => {
      liner.push(`let target: ${this.xclass.name};`);
      if (isComponent) {
        liner.push(`let fixture: ComponentFixture<${this.xclass.name}>;`);
      }
      liner.pushGroupFn(`beforeEach(`, (liner) => {
        liner.pushBlockFn(`TestBed.configureTestingModule(`, (liner) => {
          liner.pushArrayFn(`imports:`, (liner) => {
            module.imported.forEach(imp => liner.push(`${imp},`));
          });
          liner.pushArrayFn(`declarations:`, (liner) => {
            module.declarations.forEach(dec => liner.push(`${dec},`));
          });
          if (services.length > 0) {
            liner.pushArrayFn(`providers:`, (liner) => {
              for(let service of services) {
                liner.push(`{ provide: ${service}, useValue: new Stub${service}() },`);
              }
            });
          }
        });
        liner.push(`).compileComponents();`);
      }, ['async(() => {', '}));']);

      liner.pushBlank();
      liner.pushLambdaFn(`beforeEach(`, (liner) => {
        if (isComponent) {
          liner.push(`fixture = TestBed.createComponent(${this.xclass.name});`);
          liner.push(`target = fixture.debugElement.componentInstance;`);
          liner.push(`fixture.detectChanges();`);
        } else {
          liner.push(`target = ${this.makeClassNew()};`);
        }
      });
  
      liner.pushBlank();
      this.constructionTest(liner);
  
      this.makeMethodTests(liner);
    });
  }

  // Generate tests for each method in the source class
  private makeMethodTests(liner: Lines) {
    this.xclass.methods.forEach(method => {
      // this.outputMethod(method);
      const om = new GenMethod(method, this.xclass, this.source);
      liner.pushGroup(om.write());
    });
  }

  // Generate a constructor test
  private constructionTest(liner: Lines) {
    liner.pushBlockFn(`it('should create', () => `, (x: Lines) => {
      x.push('expect(target).toBeTruthy();');
    });
  }

  // Generate code to instansiate the target class
  private makeClassNew(): string {
    const params = this.xclass.construct ? this.xclass.construct.parameters.map(p => this.faker.makeValue(p)) : [];
    return `new ${this.xclass.name}(${params.join(', ')})`;
  }

}