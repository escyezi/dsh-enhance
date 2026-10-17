/** CSS Modules are compiled by the client bundle preset; the import yields its class map. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
