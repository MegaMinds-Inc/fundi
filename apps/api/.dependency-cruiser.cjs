/**
 * Neither the WhatsApp/Meta SDK nor an LLM provider SDK is installed yet
 * (Sprint 0 explicitly holds BSP/WhatsApp integration). Rules 2-3 below are
 * best-guess regexes against likely future package names, not verified
 * against a real dependency — review and tighten once the real SDK choice
 * is made. If the eventual WhatsApp integration calls the Graph API via raw
 * HTTP rather than an SDK, this dependency-graph tool structurally cannot
 * catch that (no import to match).
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-internal-imports',
      comment:
        'Domain modules may only be imported via their barrel (index.ts). Internal files (service, interfaces, etc.) are private to their own module. See ADR-002.',
      severity: 'error',
      from: {
        path: '^src/modules/([^/]+)/',
      },
      to: {
        path: '^src/modules/([^/]+)/(?!index).+',
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'no-whatsapp-sdk-outside-messaging',
      comment:
        'Only the messaging module may reference a WhatsApp/Meta SDK. See ADR-011 section 1.',
      severity: 'error',
      from: { pathNot: '^src/modules/messaging/' },
      to: {
        path: '(whatsapp|meta-business|facebook-business|@whiskeysockets|baileys)',
      },
    },
    {
      name: 'no-llm-sdk-outside-ai',
      comment: 'Only the ai module may reference an LLM provider SDK. See ADR-011 section 1.',
      severity: 'error',
      from: { pathNot: '^src/modules/ai/' },
      to: {
        path: '(^openai$|^openai/|@anthropic-ai/sdk|@google/generative-ai|@google-cloud/aiplatform|cohere-ai|@mistralai/mistralai|langchain)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
