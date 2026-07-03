declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: unknown;
  export default content;
}

declare module '*.csv' {
  const content: Array<Record<string, string | number | undefined>>;
  export default content;
}
