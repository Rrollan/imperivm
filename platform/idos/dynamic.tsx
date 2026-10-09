import React, {lazy, Suspense} from 'react';
export default function dynamic<T extends React.ComponentType<any>>(loader: () => Promise<{default: T}>, options?: {ssr?: boolean; loading?: React.ComponentType}) {
  const Component = lazy(loader), Loading = options?.loading;
  return (props: React.ComponentProps<T>) => <Suspense fallback={Loading ? <Loading/> : null}><Component {...props}/></Suspense>;
}
