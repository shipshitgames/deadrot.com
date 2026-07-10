interface ImportMeta {
  glob<T = unknown>(
    pattern: string | string[],
    options?: {
      eager?: false;
      import?: string;
      query?: string;
    },
  ): Record<string, () => Promise<T>>;

  glob<T = unknown>(
    pattern: string | string[],
    options: {
      eager: true;
      import?: string;
      query?: string;
    },
  ): Record<string, T>;
}

declare module "*.webp" {
  const url: string;
  export default url;
}
