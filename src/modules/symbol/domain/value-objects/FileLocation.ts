import { ValueObject } from "../../../../@core/domain/ValueObject.js";

interface FileLocationProps {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

/**
 * FileLocation Value Object
 *
 * Represents the location of a symbol in a source file.
 */
export class FileLocation extends ValueObject<FileLocationProps> {
  private constructor(props: FileLocationProps) {
    super(props);
    if (props.endLine < props.startLine) {
      throw new Error("endLine must be greater than or equal to startLine");
    }
  }

  get filePath(): string {
    return this.props.filePath;
  }

  get startLine(): number {
    return this.props.startLine;
  }

  get endLine(): number {
    return this.props.endLine;
  }

  get startColumn(): number | undefined {
    return this.props.startColumn;
  }

  get endColumn(): number | undefined {
    return this.props.endColumn;
  }

  get lineCount(): number {
    return this.props.endLine - this.props.startLine + 1;
  }

  public static create(props: FileLocationProps): FileLocation {
    return new FileLocation(props);
  }

  public contains(line: number): boolean {
    return line >= this.props.startLine && line <= this.props.endLine;
  }

  public overlaps(other: FileLocation): boolean {
    if (this.props.filePath !== other.filePath) {
      return false;
    }
    return !(this.props.endLine < other.startLine || this.props.startLine > other.endLine);
  }

  public toString(): string {
    const { filePath, startLine, endLine } = this.props;
    return startLine === endLine
      ? `${filePath}:${startLine}`
      : `${filePath}:${startLine}-${endLine}`;
  }
}
