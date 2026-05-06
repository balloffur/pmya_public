Typeinfo JSON pack

Files:
- typeinfo/c.json
- typeinfo/java.json
- typeinfo/js.json
- typeinfo/go.json
- typeinfo/csharp.json
- typeinfo/kotlin.json
- typeinfo/rust.json

Schema:
{
  language,
  fileId,
  scope,
  notes: string[],
  types: [
    {
      id,
      names: string[],
      kind,
      availability,
      definition,
      summary,
      standardGuarantee,
      mainstreamSizes: object,
      precision: object|null,
      rounding,
      examples: string[],
      specialRules: string[],
      aliases: string[],
      readMore: [{title,url}]
    }
  ]
}
