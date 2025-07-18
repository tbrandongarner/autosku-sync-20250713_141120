declare namespace JSX {
  interface IntrinsicElements {
    [elem: string]: any
  }
}

declare module 'react' {
  export const useState: any
  export const useEffect: any
  export const useCallback: any
  export const useMemo: any
  export type FC<P = {}> = (props: P) => any
  const React: any
  export default React
}

declare module '@shopify/polaris' {
  export const Page: any
  export const Button: any
  export const Layout: any
  export const Card: any
  export const Banner: any
  export const Stack: any
  export const Spinner: any
  export const DataTable: any
  export const TextContainer: any
  export const Filters: any
  export const ResourceList: any
  export const Badge: any
  export const Modal: any
  export const TextStyle: any
  export const Toast: any
  export const DropZone: any
  export const FormLayout: any
  export const RadioButton: any
  export const InlineError: any
  export const ButtonGroup: any
  export const TextField: any
  export const Select: any
  export const Navigation: any
}

declare module '@shopify/polaris-icons' {
  export const HomeMajor: any
  export const ImportMinor: any
  export const CodeMajor: any
  export const SettingsMajor: any
}

declare module 'react-query' {
  export const useQuery: any
}

declare module 'nanoid' {
  export function nanoid(): string
}
