import {ROMAN_SYMBOLS,type RomanSymbol} from './romanSymbols';
export function RomanIcon({name,size=24,className}:{name:RomanSymbol;size?:number;className?:string}){
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ROMAN_SYMBOLS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
