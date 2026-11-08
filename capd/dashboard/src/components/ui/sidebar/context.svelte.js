import { getContext, setContext } from "svelte";

const key = Symbol("sidebar");

export const createSidebar = (props) => {
  let openMobile = $state(false);
  let inset = $state(false);
  let isMobile = $state(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const sidebar = {
    get open() {
      return props.open();
    },
    setOpen: props.setOpen,
    get openMobile() {
      return openMobile;
    },
    set openMobile(value) {
      openMobile = value;
    },
    get inset() {
      return inset;
    },
    set inset(value) {
      inset = value;
    },
    get isMobile() {
      return isMobile;
    },
    set isMobile(value) {
      isMobile = value;
    },
    get state() {
      return props.open() ? "expanded" : "collapsed";
    },
    toggle() {
      if (isMobile) openMobile = !openMobile;
      else props.setOpen(!props.open());
    },
  };
  return setContext(key, sidebar);
};

export const useSidebar = () => {
  const sidebar = getContext(key);
  if (!sidebar)
    throw new Error("useSidebar must be used within a SidebarProvider.");
  return sidebar;
};
