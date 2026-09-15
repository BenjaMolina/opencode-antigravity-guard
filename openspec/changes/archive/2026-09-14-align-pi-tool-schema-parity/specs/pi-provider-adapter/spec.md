# Delta for Pi Provider Adapter

## ADDED Requirements

### Requirement: Gemini schema-profile routing is explicit and isolated

The provider MUST select a named Gemini `parametersJsonSchema` schema profile only for the already-enabled `antigravity-gemini-3.8-flash` route at reasoning level `off`. That profile MUST serialize declarations only as `functionDeclarations[*].parametersJsonSchema` and MUST NOT emit a legacy `parameters` field. The provider MUST NOT apply this profile to another Gemini row, another reasoning level, Claude, GPT-OSS, or any future route merely because that route becomes otherwise reachable.

A tool-bearing context for every tool-disabled row/route MUST continue to fail before transport through its capability policy, without schema normalization that broadens its behavior, declaration omission, fallback, model substitution, or a network request. Text-only behavior on those rows/routes MUST remain unchanged.

#### Scenario: Enabled Gemini route uses the named profile

- GIVEN `antigravity-gemini-3.8-flash` at reasoning level `off` receives valid Pi tool declarations
- WHEN the provider serializes the context
- THEN every declaration MUST be serialized in source order under `functionDeclarations[*].parametersJsonSchema` and no declaration MUST contain a legacy `parameters` field

#### Scenario: Disabled routes remain isolated

- GIVEN a Gemini route other than Gemini 3.8 Flash `off`, or a Claude or GPT-OSS route, is tool-disabled
- WHEN it receives a tool-bearing context
- THEN the provider MUST fail through the existing capability boundary before transport and MUST preserve that route's text-only behavior

### Requirement: Schema-profile claims and verification have an explicit evidence boundary

The Pi package README MUST describe the Gemini schema profile as limited to the currently evidence-enabled Gemini 3.8 Flash `off` tool route. It MUST distinguish hermetic preservation and preflight verification from direct live backend acceptance, MUST NOT claim support for disabled routes or unperformed live validation, and MUST NOT represent the existing simple echo evidence as proof of the broader constrained or reference-based schema set.

The change MUST have hermetic verification covering the schema-profile normalization, exact request serialization, fail-closed preflight, disabled-route isolation, and unchanged tool lifecycle compatibility. Required verification MUST include the focused Pi schema, context, tool-context, response, stream, and probe-test suites; Pi and root typecheck/build checks; packed-package installation verification; and the full test suite. A live model call, credential access, evidence-record rewrite, or publication MUST NOT be required to satisfy this change. Any later live claim for broader schemas MUST require separately authorized, route-scoped, redacted direct evidence and MUST NOT replace hermetic hostile-input coverage.

#### Scenario: Documentation does not overstate support

- GIVEN a reader consults the Pi package README after this change
- WHEN the reader determines which tool schemas and routes are supported
- THEN the README MUST name Gemini 3.8 Flash `off` as the only evidence-enabled route and MUST distinguish hermetic compatibility from unperformed live validation

#### Scenario: Hermetic verification does not imply a live claim

- GIVEN the required hermetic checks pass without a live model call
- WHEN the change is evaluated for correctness
- THEN the checks MUST establish the local serialization and safety contract without asserting direct backend acceptance of constrained or reference-based schemas

## MODIFIED Requirements

### Requirement: Tool schemas use bounded immutable normalization

For the named Gemini `parametersJsonSchema` profile, the provider MUST use a typed Pi-local schema boundary and MUST NOT import OpenCode host-specific request transformation, configuration, logging, or permissive cleanup into the Pi runtime. It MUST accept structurally valid, JSON-compatible ordinary JSON Schema content from an otherwise valid Pi tool declaration rather than applying a legacy protobuf-style keyword allowlist. It MUST preserve the accepted-value semantics and JSON values of ordinary schema keywords and constraints, including `additionalProperties` (boolean or schema-valued), `minItems`, `maxItems`, `minLength`, `maxLength`, `pattern`, numeric bounds, `uniqueItems`, combinators, defaults, and `patternProperties`. It MUST NOT translate constraints into descriptions, silently erase constraints, repair schemas, or fall back to a legacy Claude/GPT conversion.

The boundary MUST resolve only local RFC 6901 references equal to `#` or beginning `#/` against the original declaration schema. It MUST decode `~0` and `~1`, support valid array-index segments, expand repeated resolvable references deterministically, preserve valid reference siblings without weakening either meaning, and remove emitted resolved `$ref`, `$defs`, and Draft-07 `definitions` control containers only after successful expansion. It MUST reject before transport every external, URI, malformed, missing, unresolved, non-local, cyclic, recursive, or otherwise unsafe reference; malformed pointer escape; invalid array index; or unsafe reference-sibling combination. The boundary MUST strip only `$schema`, `$id`, `$anchor`, `$dynamicAnchor`, `$vocabulary`, and `$comment`, plus successfully resolved definition containers. A keyword-like name inside a schema `properties` map, including `$ref` or `definitions`, MUST remain a user property name rather than being treated as a control keyword.

The boundary MUST accept only own data on plain objects and dense arrays, finite JSON numbers, JSON primitives, and JSON-compatible values. It MUST reject before transport getters or other accessors, inherited values, symbols, sparse arrays, class instances, functions, `undefined`, `bigint`, non-finite numbers, direct object cycles, reference cycles, recursive expansion, and structurally invalid schema values. Validation and diagnostics MUST identify the declaration and a safe structural path without evaluating accessors or exposing schema values, descriptions, prompts, arguments, credentials, or other sensitive content.

Normalization and reference expansion MUST enforce a maximum nesting depth of 32, a maximum of 2,048 processed or expanded nodes per declaration, a maximum canonical serialized size of 256 KiB per declaration, and a maximum canonical serialized size of 1 MiB across the request. Exceeding any limit MUST fail locally before transport. The output MUST be canonical with deterministic key ordering, deeply frozen, and independent of input insertion order. The provider MUST NOT mutate the Pi context, declarations, schemas, or nested input values.

Declaration validation MUST be all-or-nothing: the provider MUST validate the complete ordered declaration set before transport, retain every valid declaration in source order, and reject the complete request if any declaration, schema profile, reference, runtime value, or aggregate limit is invalid. It MUST NOT skip, omit, downgrade, retry, or substitute an individual declaration. The Gemini 3.8 Flash `off` regression for the `ask_user_choice` declaration MUST retain root and nested `additionalProperties: false` and the bounded options-array constraints through exact `parametersJsonSchema` request serialization.

(Previously: The Pi-local boundary admitted only a narrow legacy-compatible subset, rejected references, definitions, metadata, defaults, ordinary constraints, additional-property schemas, and unknown keywords, and allowed only a limited `const`-to-`enum` normalization.)

#### Scenario: A supported constant is normalized without mutation

- GIVEN a valid Gemini-profile declaration whose schema contains an ordinary JSON Schema `const` value
- WHEN the declaration is normalized
- THEN the output MUST retain that value and all other accepted schema semantics, use canonical immutable output, and leave the complete input context unchanged

#### Scenario: A lossy schema is rejected

- GIVEN a declaration whose schema contains an unsafe runtime value, invalid local reference, external reference, reference cycle, malformed pointer, unsafe sibling merge, or a resource-limit overflow
- WHEN the provider validates the complete declaration set
- THEN it MUST reject the request before transport with the declaration and safe schema path and MUST NOT drop, repair, or serialize any declaration

#### Scenario: `ask_user_choice` retains ordinary TypeBox constraints

- GIVEN Gemini 3.8 Flash `off` receives the published `ask_user_choice` declaration with nested closed objects, root and nested `additionalProperties: false`, and bounded `options` array constraints
- WHEN the request is serialized
- THEN its declaration MUST reach `functionDeclarations[*].parametersJsonSchema` with those constraints intact and without a legacy `parameters` field

#### Scenario: Local references are expanded without losing semantics

- GIVEN a valid declaration contains repeated local references through `$defs` or `definitions`, including escaped pointer segments, valid array indexes, combinator references, and valid reference siblings
- WHEN the declaration is normalized for the Gemini profile
- THEN the emitted canonical schema MUST preserve the referenced semantics, contain no resolved `$ref`, `$defs`, or `definitions` control container, and retain keyword-like property names in `properties`

#### Scenario: One invalid declaration prevents all transport

- GIVEN an ordered declaration set contains one valid declaration and one declaration that is invalid or exceeds an aggregate limit
- WHEN the provider preflights the context
- THEN it MUST reject the complete request before fetch, make zero network calls, and MUST NOT serialize only the valid declaration
