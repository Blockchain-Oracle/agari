import { ImageResponse } from 'next/og';

export const alt = 'Agari Docs — step-by-step guides to the Solana devnet build';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The share image is rendered locally at build time, with the product mark's exact SVG geometry. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#F4EEE3',color:'#141210',padding:'52px 64px',fontFamily:'sans-serif' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',paddingBottom:32,borderBottom:'1px solid #D6CBB7' }}>
        <span style={{ color:'#D93E1F',fontSize:18,letterSpacing:3 }}>THE AGARI HANDBOOK</span>
        <div style={{ display:'flex',alignItems:'center',gap:13 }}>
          <svg width="37" height="45" viewBox="0 0 266 322" xmlns="http://www.w3.org/2000/svg">
            <path d="M56 120 A 88 88 0 1 0 210 120" stroke="#141210" fill="none" strokeWidth="34" strokeLinecap="round" />
            <circle cx="133" cy="62" r="30" fill="#D93E1F" />
          </svg>
          <span style={{ fontSize:30,fontWeight:700 }}>Agari</span>
        </div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',marginTop:52 }}>
        <span style={{ fontSize:74,fontWeight:700,letterSpacing:-3,lineHeight:1.08 }}>Agari,</span>
        <span style={{ fontSize:74,fontWeight:700,letterSpacing:-3,lineHeight:1.08,color:'#D93E1F' }}>explained simply.</span>
        <span style={{ fontSize:25,lineHeight:1.5,color:'#655B4D',marginTop:24 }}>Step-by-step guides to a Solana devnet stock Up/Down market.</span>
      </div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'auto',paddingTop:28,borderTop:'1px solid #D6CBB7' }}>
        <div style={{ display:'flex',gap:12 }}>
          {['Make a call','Sessions and lanes','Read the architecture'].map((label) => <span key={label} style={{ display:'flex',fontSize:18,border:'1px solid #D6CBB7',borderRadius:24,padding:'10px 20px',background:'#FBF7EE' }}>{label}</span>)}
        </div>
        <span style={{ color:'#655B4D',fontSize:18 }}>Documentation</span>
      </div>
    </div>,
    size,
  );
}
