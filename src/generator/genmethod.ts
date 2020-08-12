import { XMethod, XClass, XBlock, XIf, XCondition } from '../common/xclasses';
import { DataFaker } from './data-faker';
import { SourceFile, SyntaxKind } from 'typescript';
import { Lines, Line } from './gentext';
import { Util } from '../common/util';

// Generates test code for a method
export class GenMethod {
  private faker = new DataFaker();
  private callName: string;
  private args = {};
  private counter: number = 1;

  constructor(private xmethod: XMethod, private xclass: XClass, private source: SourceFile) {}

  // main method
  write(): Line[] {
    const dbug1 = 'remove';
    const dbug2 = 'PlayerComponent';
    if (this.xclass.name === dbug2 && this.xmethod.name === dbug1) {
      console.log(``);
    }

    // console.log(`*** ${this.xclass.name}.${this.xmethod.name}`);

    this.callName = this.xmethod.isStatic ? this.xclass.name : 'target';
    this.callName = this.xmethod.isPublic ? this.callName : `(<any>${this.callName})`;

    return Lines.makeList((liner: Lines) => {
      liner.pushBlank();
      liner.pushLambdaFn(`it('should test method ${this.xmethod.name}', `, (liner: Lines) => {
        if (this.xmethod.codeblock.branches.length === 0) {
          const params = this.xmethod.parameters.map(p => this.faker.makeValue(p)).join(', ');
          liner.pushTryCatchOneLine(`${this.callName}.${this.xmethod.name}(${params});`, this.xmethod.name);
        } else {
          this.outputBlock(liner, this.xmethod.codeblock);
        }

        liner.push('expect(target).toBeTruthy();');
      })
    });
  }

  // process a block ('{...}') of code
  // Note: this can be called recursively
  private outputBlock(liner: Lines, block: XBlock) {
    if (block && block.branches) {
      block.branches.forEach(branch => {
        // let comment = `// Block ${SyntaxKind[branch.node.kind]} '${Util.stmtText(this.source.getText(), branch.node.pos)}'`;
        liner.pushGroup(this.outputBranch(branch));
      });
    }
  }

  // Process a branch (an 'if' statement)
  private outputBranch(branch: XIf): Line[] {
    console.log(`  outputBranch ${Util.stmtText(this.source.getText(), branch.node.pos)}`);
    return Lines.makeList((liner: Lines) => {
      branch.conditions.forEach(xc => {
        const values = this.faker.callValues(xc, this.source);
        values.forEach(value => {
          branch.ifBlock.forEach(block => {
            this.outputBlock(liner, block);
          });
          if (branch.elseBlock) {
            this.outputBlock(liner, branch.elseBlock);
          } 
          const precall = this.prepareCall(xc, branch, value);
          liner.pushGroup(this.makeCall(xc, value, precall));
        });
      });
    });
  }

  // Prepare for the call by setting approriate values, such as class variables, if need be
  private prepareCall(xc: XCondition, branch: XIf, value: any): Line[] {
    // Util.dumpWith('prepareCall', xc.node, this.source);

    return Lines.makeList((liner: Lines) => {
      if (!xc.left) {
        // Unary expression
        // This is an expression which resolves to true or false: do nothing
      } else {
        const item = this.faker.getLiteral(xc, branch, this.source);
        if (item.isLiteral) {
          const propName = item.left.name;
          const param = this.xmethod.parameters.find(x => x.name === propName);
          if (param) {
            this.args[param.name] = value;
          } else {
            const prop = this.xclass.properties.find(x => x.name === propName);
            if (prop) {
              // set a property on the target object
              // const comment = `// Prepare ${SyntaxKind[xc.node.kind]} '${Util.stmtText(this.source.getText(), xc.node.pos)}', value=${value}`;
              // liner.push(comment);
              const code = `(<any>target).${prop.name} = ${value};`;
              liner.push(code);
            }
          }
        }
      }
    });
  }

  // This method is calling another method
  private makeCall(xc: XCondition, testValue: any, precall: Line[]) {
    let comment = `Make call -> '${Util.stmtText(this.source.getText(), xc.node.pos)}'`;

    if (xc.left) {
      const left = Util.getName(xc.left);
      const op = SyntaxKind[xc.operator];
      const right = xc.right ? Util.getName(xc.right) : '';
      comment = `Test case: ${left} ${op} ${right}`;
    }
    comment += `, with value '${testValue}'`;

    let methodRef = this.xmethod.name;
    if (this.counter) {
      methodRef = `${methodRef} (${this.counter})`;
      this.counter++;
    }

    return Lines.makeList((liner: Lines) => {
      liner.pushTryCatchFn(methodRef, (liner) => {
        liner.pushComment(comment);
        liner.pushGroup(precall);
        liner.push(`${this.callName}.${this.xmethod.name}(${this.callArgs().join(', ')});`);
      });
    });
  }

  // Get the parameters for the method
  private callArgs(): string[] {
    const args: string[] = [];
    this.xmethod.parameters.forEach(p => {
      const arg = this.args[p.name];
      if (arg) {
        args.push(arg);
      } else {
        args.push(this.faker.makeValue(p));
      }
    });
    return args;    
  }

}