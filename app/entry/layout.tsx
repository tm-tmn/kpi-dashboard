import { AppShell } from "@/components/AppShell";

export default function EntryLayout({ children }: LayoutProps<"/entry">) {
  return <AppShell>{children}</AppShell>;
}
