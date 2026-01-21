import SidebarContent from './SidebarContent';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <SidebarContent />
    </aside>
  );
}

