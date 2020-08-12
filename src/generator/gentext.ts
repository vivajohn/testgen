// Represents a line of text with an associated section of text which will be indented
export class Line {
  constructor(public text: string, public indentedLines: Line[] = []) {}
}

// A collection of Line objects
export class Lines {

  list: Line[] = [];

  static makeList(fn:(Lines) => void): Line[] {
    const lines = new Lines();
    fn(lines);
    return lines.list;
  }

  // Push a line into the collection.
  // The associated section will eventually be indented.
  push(code: string, section: Line[] = undefined): Line {
    const line = new Line(code, section);
    this.list.push(line);
    return line;
  }

  // Add an empty line
  pushBlank(): Line {
    return this.push('');
  }


  // Add an empty line
  pushComment(comment: string): Line {
    return this.push('// ' + comment);
  }

  // Adds a group of lines
  pushGroup(group: Line[], leadingBlank = false) {
    if (!group || group.length === 0) {
      return
    }
    if(leadingBlank) {
      this.pushBlank();
    }
    this.list = [...this.list, ...group];
  }

  // Push a line and add brackets around the associated code block.
  pushBlock(code: string, block: Line[], delimiter = ['{', '}']) {
    let s = delimiter[0];
    // if (code[code.length - 1] !== ' ') {
    //   s = ' ' + delimiter[0];
    // }
    this.push(code + s, block);
    this.push(delimiter[1]);
  }

  pushGroupFn(code: string, fn:(Lines) => void, delimiter = ['', '']) {
    const liner = new Lines();
    fn(liner);
    this.pushBlock(code, liner.list, delimiter);
  }

  pushBlockFn(code: string, fn:(Lines) => void) {
    this.pushGroupFn(code, fn, ['{', '}']);
  }

  pushLambdaFn(code: string, fn:(Lines) => void, delimiter = ['() => {', '});']) {
    this.pushGroupFn(code, fn, delimiter);
  }

  pushArrayFn(code: string, fn:(Lines) => void) {
    this.pushGroupFn(code, fn, ['[', ']']);
  }

  // Put a try-catch block around the passed code block
  pushTryCatch(block: Line[], errorSource: string) {
    this.pushBlock('try', block);
    const catchBlock = [new Line(`console.error('Error in ${errorSource}: ' + err);`)];
    this.pushBlock('catch(err)', catchBlock);
  }

  pushTryCatchFn(errorSource: string, fn:(Lines) => void) {
    this.pushTryCatch(this.getBlock(fn), errorSource);
  }

  pushTryCatchOneLine(code: string, errorSource: string) {
    this.pushTryCatch([new Line(code)], errorSource);
  }

  private getBlock(fn:(Lines) => void): Line[] {
    // We must run the function in a different context because calls can be recursive
    // and the order of the lines would not be respected in that case.
    const newContext = new Lines();
    fn(newContext);
    return newContext.list;
  }
}

// Generates text from a Lines object
export class GenText {

  static generate(lines: Line[], indent = 2, indentSize = 2): string {
    let text = '';
    lines.forEach(line => {
      if (line.text !== undefined && line.text != null) {
        text += ''.padStart(indent) + line.text + '\n';
      }
      line.indentedLines.forEach(x => {
        text += this.generate([x], indent + indentSize, indentSize);
      });
    });
    return text;
  }

}