declare module "*.mdx" {
  export const title: string;
  export const subtitle: string;
  export const byline: { label: string; value: string }[];
}
