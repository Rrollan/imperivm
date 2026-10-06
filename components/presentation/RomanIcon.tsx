import {ROMAN_SYMBOLS,type RomanSymbol} from './romanSymbols';
export function RomanIcon({name}:{name:RomanSymbol}){
  return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ROMAN_SYMBOLS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
