export default function Sidebar({ current, onNavigate }: SidebarProps) {
  const navigationItems = [
    {
      label: 'Dashboard',
      icon: HomeMajor,
      selected: current === 'dashboard',
      onClick: () => onNavigate('dashboard'),
    },
    {
      label: 'Feeds',
      icon: ImportMinor,
      selected: current === 'feeds',
      onClick: () => onNavigate('feeds'),
    },
    {
      label: 'Mappings',
      icon: CodeMajor,
      selected: current === 'mappings',
      onClick: () => onNavigate('mappings'),
    },
    {
      label: 'Settings',
      icon: SettingsMajor,
      selected: current === 'settings',
      onClick: () => onNavigate('settings'),
    },
  ]

  return (
    <Navigation location={current}>
      <Navigation.Section items={navigationItems} />
    </Navigation>
  )
}