import { Entity } from "../../../../@core/domain/Entity.js";

export interface DocMappingProps {
  symbolName: string;
  docPath: string;
  section?: string;
  updatedAt?: Date;
}

/**
 * DocMapping Entity
 *
 * Maps symbols to their documentation locations.
 */
export class DocMapping extends Entity<DocMappingProps, string> {
  private constructor(props: DocMappingProps, id: string) {
    super(props, id);
  }

  get symbolName(): string {
    return this.props.symbolName;
  }

  get docPath(): string {
    return this.props.docPath;
  }

  get section(): string | undefined {
    return this.props.section;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  public static create(props: DocMappingProps): DocMapping {
    const id = `${props.symbolName}::${props.docPath}`;
    return new DocMapping(props, id);
  }

  public static fromPersistence(props: DocMappingProps): DocMapping {
    const id = `${props.symbolName}::${props.docPath}`;
    return new DocMapping(props, id);
  }
}
