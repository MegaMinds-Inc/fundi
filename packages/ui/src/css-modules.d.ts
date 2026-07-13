// Ambient declaration so `import styles from './X.module.css'` type-checks in
// this package's own standalone typecheck. In the apps, Next provides the same
// declaration via next-env.d.ts; this makes @fundi/ui self-consistent too.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
