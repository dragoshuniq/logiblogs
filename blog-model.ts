import type { ContentBlock } from "./types";
import mongoose, { Schema, Document, Model } from "mongoose";

export enum Languages {
  EN = "en",
  DE = "de",
  FR = "fr",
  PL = "pl",
  UA = "ua",
  RO = "ro",
  ES = "es",
  PT = "pt",
  IT = "it",
  NL = "nl",
  SE = "se",
  NO = "no",
  FI = "fi",
  DK = "dk",
  TR = "tr",
}

export interface IAuthor {
  name: string;
  role: string;
  avatar: string;
}

const TextSpanSchema = new Schema(
  {
    text: { type: String, required: true },
    bold: { type: Boolean },
    italic: { type: Boolean },
    tooltip: { type: String },
  },
  { _id: false }
);

const GalleryImageSchema = new Schema(
  {
    src: { type: String, required: true },
    alt: { type: String, required: true },
    caption: { type: String },
  },
  { _id: false }
);

export interface IBlog extends Document {
  id: string;
  shortId: string;
  isVisible: boolean;
  readTime: number;
  language: string;
  title: string;
  description: string;
  publishedAt: Date;
  category: string;
  author: IAuthor;
  image: string;
  imageAlt: string;
  content: ContentBlock[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AuthorSchema = new Schema<IAuthor>(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    avatar: { type: String, required: true },
  },
  { _id: false }
);

const ContentBlockSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "paragraph",
        "heading",
        "quote",
        "code",
        "callout",
        "divider",
        "button",
        "embed",
        "gallery",
        "table",
        "stat",
        "list",
        "image",
        "citation",
      ],
    },
    children: { type: [TextSpanSchema] },
    text: { type: String },

    level: { type: Number, min: 1, max: 6 },

    author: { type: String },

    language: { type: String },
    content: { type: String },

    variant: {
      type: String,
      enum: [
        "info",
        "warning",
        "success",
        "danger",
        "primary",
        "secondary",
        "outlined",
      ],
    },

    src: { type: String },
    alt: { type: String },
    caption: { type: String },

    url: { type: String },

    provider: { type: String, enum: ["youtube", "vimeo", "map"] },
    title: { type: String },

    images: { type: [GalleryImageSchema] },

    rows: { type: [[String]] },

    label: { type: String },
    value: { type: String },
    description: { type: String },

    ordered: { type: Boolean },
    items: { type: [[TextSpanSchema]] },
  },
  {
    _id: false,
    strict: false,
    toJSON: { virtuals: false, getters: false },
    toObject: { virtuals: false, getters: false },
  }
);

const BlogSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    shortId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isVisible: { type: Boolean, required: true, default: true },
    readTime: { type: Number, required: true },
    language: {
      type: String,
      enum: Object.values(Languages),
      required: true,
      default: Languages.EN,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    category: { type: String, required: true },
    author: { type: AuthorSchema, required: true },
    image: { type: String, required: true },
    imageAlt: { type: String, required: true },
    content: { type: [ContentBlockSchema], required: true },
    tags: { type: [String], required: true, default: [] },
  },
  { timestamps: true }
);

BlogSchema.index({ publishedAt: -1 });
BlogSchema.index({ category: 1 });
BlogSchema.index({ language: 1 });
BlogSchema.index({ tags: 1 });
BlogSchema.index({ isVisible: 1, publishedAt: -1 });

const Blog: Model<IBlog> =
  mongoose.models.Blog ||
  mongoose.model<IBlog>("Blog", BlogSchema, "blogs");

export default Blog;
