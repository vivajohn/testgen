import { Node, SyntaxKind, Expression } from 'typescript';

// This files which represent the structure of the input code. The names start with
// an 'X' to distinguish them from parser structures and typescript keywords.

export enum BaseType {
  xstring,
  xnumber,
  xboolean,
  xobject
}

export class XNode {
  parent: XNode;
  node: Node;

  constructor(node: Node, parent: XNode) {
    this.node = node;
    this.parent = parent;
  }
}

export class XProgram extends XNode {
  classes: XClass[] = [];
}

export class XClass extends XNode {
  parent: XProgram;
  name: string;
  properties: XProperty[] = [];
  methods: XMethod[] = [];
  construct: XMethod;
}

export class XMethod extends XNode {
  name: string;
  parameters: XProperty[] = [];
  codeblock: XBlock;
  returns: BaseType;
  isPublic = true;
  isStatic = false;
}

export class XBlock extends XNode {
  properties: XProperty[] = [];
  branches: XIf[] = [];
}

export class XProperty extends XNode {
  isClassVar = false;
  isArray = false;
  isLiteral = false; // This is a string containing a number, a string, or true/false

  type: SyntaxKind;
  initializer: string;
  name: string;
  typeName: string;
}

// A simple if statement has 1 condition, 1 block and possibly an else block.
// A conditional statement has 1 condition, 1 if block and 1 else block.
// A switch statement has one  or more conditions, as many if blocks and possibly a default block, which is the elseBlock here.
export class XIf extends XNode {
  isSwitch = false;
  conditions: XCondition[] = [];
  ifBlock: XBlock[] = [];
  elseBlock: XBlock;
}

export class XSwitch extends XIf {
  constructor(node: Node, parent: XNode) {
    super(node, parent);
    this.isSwitch = true;
  }
}

export class XCondition extends XNode {
  // If unary condition(i.e. '!isWhatever'), only left?
  left: Expression;
  right: Expression;
  operator: SyntaxKind;
}
