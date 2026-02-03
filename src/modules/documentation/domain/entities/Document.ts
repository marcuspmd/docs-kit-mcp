import { Entity } from "../../../../@core/domain/Entity.js";

export interface DocumentProps {
  path: string;
  title?: string;
  content: string;
  frontmatter?: Record<string, unknown>;
  symbols?: string[];
  lastModified?: Date;
}

/**
 * Document Entity
 *
 * Represents a documentation file.
 */
export class Document extends Entity<DocumentProps, string> {
  private constructor(props: DocumentProps, id: string) {
    super(props, id);
  }

  get path(): string {
    return this.props.path;
  }

  get title(): string | undefined {
    return this.props.title;
  }

  get content(): string {
    return this.props.content;
  }

  get frontmatter(): Record<string, unknown> | undefined {
    return this.props.frontmatter;
  }

  get symbols(): string[] {
    return this.props.symbols ?? [];
  }

  get lastModified(): Date | undefined {
    return this.props.lastModified;
  }

  public static create(props: DocumentProps): Document {
    const id = props.path;
    return new Document(props, id);
  }

  public static fromPersistence(id: string, props: DocumentProps): Document {
    return new Document(props, id);
  }

  public updateContent(content: string): Document {
    return new Document({ ...this.props, content, lastModified: new Date() }, this.id);
  }

  public addSymbol(symbolId: string): Document {
    const symbols = [...(this.props.symbols ?? []), symbolId];
    return new Document({ ...this.props, symbols }, this.id);
  }
}
