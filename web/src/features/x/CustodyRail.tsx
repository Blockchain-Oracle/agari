/** The hero proof (reference `CustodyRail`): a mention → a bounded agent → a position that is yours; the withdraw door does not exist. */
export function CustodyRail({ handle }: { handle: string }) {
  return (
    <figure className="m-0">
      <div className="xt-rail">
        <svg viewBox="0 0 440 300" role="img" aria-label="The agent can only open a position you own; there is no withdraw path." className="xt-rail-mono">
          <defs>
            <radialGradient id="xtGlow" cx="50%" cy="42%" r="55%">
              <stop offset="0%" stopColor="var(--xt-v)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--xt-v)" stopOpacity="0" />
            </radialGradient>
            <marker id="xtArrM" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--xt-m)" />
            </marker>
          </defs>
          <rect x="150" y="70" width="200" height="110" fill="url(#xtGlow)" />
          <path d="M150,48 C205,62 214,88 232,106" fill="none" stroke="var(--xt-v)" strokeWidth="1.6" opacity="0.9" className="xt-flow" />
          <path d="M272,116 L346,116" fill="none" stroke="var(--xt-v)" strokeWidth="1.6" opacity="0.9" className="xt-flow" />
          <path d="M398,146 C398,214 320,262 292,262" fill="none" stroke="var(--xt-m)" strokeWidth="1.8" className="xt-flowm" markerEnd="url(#xtArrM)" />
          <path d="M252,142 L252,190" fill="none" stroke="var(--xt-v)" strokeWidth="1.4" strokeDasharray="3 4" opacity="0.55" />
          <g>
            <rect x="6" y="32" width="150" height="32" rx="8" fill="var(--xt-paper)" stroke="rgba(255,255,255,0.14)" />
            <text x="16" y="52" fontSize="11" fill="var(--xt-wire)">{`${handle} btc up 5 15m`}</text>
          </g>
          <g>
            <path className="xt-node-draw" d="M252,90 L280,106 L280,138 L252,154 L224,138 L224,106 Z" fill="var(--xt-agent)" stroke="var(--xt-v)" strokeWidth="1.4" />
            <text x="252" y="126" textAnchor="middle" fontSize="9.5" fill="var(--xt-v)">agent</text>
          </g>
          <text x="252" y="172" textAnchor="middle" fontSize="8.5" fill="var(--xt-muted)">bounded key · placeFor</text>
          <g>
            <rect x="346" y="92" width="88" height="50" rx="10" fill="var(--xt-mint-paper)" stroke="var(--xt-m)" strokeOpacity="0.5" />
            <text x="390" y="112" textAnchor="middle" fontSize="10" fill="var(--xt-mint-ink)">BTC · yours</text>
            <text x="390" y="130" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--xt-m)">5.00</text>
          </g>
          <text x="390" y="160" textAnchor="middle" fontSize="8" fill="var(--xt-m)" opacity="0.8">unchanged</text>
          <g>
            <rect x="212" y="248" width="80" height="28" rx="9" fill="var(--xt-paper)" stroke="rgba(255,255,255,0.16)" />
            <text x="252" y="266" textAnchor="middle" fontSize="11" fill="var(--xt-wire)">you</text>
          </g>
          <g className="xt-seal">
            <rect x="150" y="189" width="204" height="32" rx="8" fill="var(--xt-seal)" stroke="var(--xt-v)" strokeOpacity="0.5" />
            <g transform="translate(167,205)">
              <rect x="-5" y="-3" width="10" height="7.5" rx="1.5" fill="none" stroke="var(--xt-v)" strokeWidth="1.2" />
              <path d="M-2.5,-3 v-2 a2.5,2.5 0 0 1 5,0 v2" fill="none" stroke="var(--xt-v)" strokeWidth="1.2" />
              <line x1="-7.5" y1="6" x2="7.5" y2="-6.5" stroke="var(--xt-v)" strokeWidth="1.3" />
            </g>
            <text x="183" y="208.5" fontSize="8.5" fill="var(--xt-sealtext)">withdrawTo() · transfer() · sweepTo()</text>
            <line x1="183" y1="205" x2="347" y2="205" stroke="var(--xt-v)" strokeWidth="1" strokeOpacity="0.55" />
          </g>
          <text x="252" y="235" textAnchor="middle" fontSize="8.5" fill="var(--xt-faint)">no such function for the agent</text>
          <g className="xt-attack-only">
            <circle r="3.4" fill="var(--xt-v)">
              <animateMotion dur="6s" repeatCount="indefinite" keyPoints="0;0.62;0.62" keyTimes="0;0.42;1" calcMode="linear" path="M150,48 C205,62 214,88 232,106 L252,124 L252,190" />
              <animate attributeName="opacity" dur="6s" repeatCount="indefinite" keyTimes="0;0.05;0.4;0.46;1" values="0;1;1;0;0" />
            </circle>
          </g>
        </svg>
      </div>
      <figcaption className="xt-rail-cap">
        you mention → the agent opens → <strong>the position is yours.</strong>
      </figcaption>
    </figure>
  );
}
