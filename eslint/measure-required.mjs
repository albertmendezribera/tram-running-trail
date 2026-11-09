// A figure with a unit, written as text in a template. `m` and `g` need the
// lookahead so that words starting with those letters do not match.
const FIGURE_WITH_UNIT = /\d(?:[\d.,:]*\d)?\s*(?:km-esforç|km|m\/h|m\s*D\+|D\+|\/km|mm|m|g)(?![\p{L}\p{N}])/u;

/** CLAUDE.md 6.4: no figure reaches the page without going through Measure. */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow figures with units written as text in templates' },
    messages: { useMeasure: 'Use <Measure> for "{{text}}": it formats the figure for the locale and handles absent values.' },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        const match = FIGURE_WITH_UNIT.exec(node.value);
        if (match) context.report({ node, messageId: 'useMeasure', data: { text: match[0] } });
      },
    };
  },
};
