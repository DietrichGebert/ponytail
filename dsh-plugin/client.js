// Ponytail for DeepSeek Harness: Web client half.
//
// The mark reads the host-owned `ponytail` session projection, shows the
// current intensity beside it, and cycles the intensity on click. Off is not
// claimed as active: it is dimmed, labelled OFF, and one click turns it on.
window.__ModuleLoader__.load({
  id: 'dsh-ponytail',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // Filled head-with-ponytail silhouette; the two subpaths are glasses cut
    // out with fill-rule evenodd so the mark still reads at 16px.
    const MARK = 'M15.2 3.8c-3.2 0-5.8 2.4-5.8 5.6 0 2 1 3.7 2.6 4.8L9.6 21c3.2-.6 5.7-2.7 6.7-5.7.6-1.9.8-3.9.8-6 0-3.3-1.3-5.5-1.9-5.5ZM10.4 8.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM14.6 8.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z'

    function nextMode(mode) {
      if (mode === 'ultra') return 'lite'
      if (mode === 'full') return 'ultra'
      if (mode === 'lite') return 'full'
      return 'full'
    }

    return {
      inject: ['slots', 'remote', 'remote.commands'],
      apply(ctx) {
        function Mark({ useProjection, sessionId, inputActions }) {
          const [hover, setHover] = React.useState(false)
          const state = useProjection('ponytail')
          if (state == null) return null
          const mode = state.mode || 'full'
          const off = mode === 'off'
          const target = nextMode(mode)
          const label = off ? 'Ponytail off' : `Ponytail ${String(mode).toUpperCase()}`
          const hint = off ? 'click to enable full' : `click for ${target}`

          const cycle = () => {
            const line = `/ponytail ${target}`
            const commands = ctx.remote && ctx.remote.commands
            const fallback = () => {
              if (inputActions && sessionId) {
                inputActions.setDraft(line)
                inputActions.submit()
              }
            }
            if (commands && sessionId) {
              Promise.resolve(commands.execute(sessionId, line, [])).then(
                (result) => { if (!result || result.ok !== true) fallback() },
                fallback,
              )
              return
            }
            fallback()
          }

          return h('button', {
            type: 'button',
            'data-ponytail-mode': mode,
            title: `${label} — ${hint}`,
            'aria-label': `${label}. ${hint}.`,
            onClick: cycle,
            onMouseEnter: () => setHover(true),
            onMouseLeave: () => setHover(false),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 24,
              padding: '0 4px',
              border: 0,
              borderRadius: 6,
              background: hover ? 'rgba(127,127,127,0.14)' : 'transparent',
              color: 'currentColor',
              cursor: 'pointer',
              opacity: off ? 0.45 : 0.9,
              font: 'inherit',
            },
          },
          h('svg', {
            viewBox: '0 0 24 24',
            width: 16,
            height: 16,
            'aria-hidden': true,
            fill: 'currentColor',
            fillRule: 'evenodd',
          }, h('path', { d: MARK })),
          h('span', {
            'aria-hidden': true,
            style: {
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.04em',
              lineHeight: 1,
              textTransform: 'uppercase',
            },
          }, mode))
        }

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'ponytail-mark',
          order: 50,
          label: 'Ponytail',
        }, Mark))
      },
    }
  },
})
