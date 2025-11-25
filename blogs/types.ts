export type TextSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  tooltip?: string;
};

export type ParagraphBlock = {
  type: "paragraph";
  children: TextSpan[];
};

export type HeadingBlock = {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
};

export type QuoteBlock = {
  type: "quote";
  text: string;
  author?: string;
};

export type CodeBlock = {
  type: "code";
  language: string;
  content: string;
};

export type CalloutBlock = {
  type: "callout";
  variant: "info" | "warning" | "success" | "danger";
  children: TextSpan[];
};

export type DividerBlock = {
  type: "divider";
};

export type ButtonBlock = {
  type: "button";
  text: string;
  url: string;
  variant?: "primary" | "secondary" | "outlined";
};

export type EmbedBlock = {
  type: "embed";
  provider: "youtube" | "vimeo" | "map";
  url: string;
  title?: string;
};

export type GalleryBlock = {
  type: "gallery";
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
};

export type TableBlock = {
  type: "table";
  rows: string[][];
};

export type StatBlock = {
  type: "stat";
  label: string;
  value: string;
  description?: string;
};

export type ListBlock = {
  type: "list";
  ordered: boolean;
  items: TextSpan[][];
};

export type ImageBlock = {
  type: "image";
  src: string;
  alt: string;
  caption?: string;
};

export type CitationBlock = {
  type: "citation";
  text: string;
  author?: string;
  url: string;
};

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | CodeBlock
  | CalloutBlock
  | DividerBlock
  | ButtonBlock
  | EmbedBlock
  | GalleryBlock
  | TableBlock
  | StatBlock
  | ListBlock
  | ImageBlock
  | CitationBlock;
