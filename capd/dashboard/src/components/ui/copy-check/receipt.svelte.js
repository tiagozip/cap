export const COPIED_HOLD = 1500;

export const createReceipt = (hold = COPIED_HOLD) => {
  let copied = $state(false);
  let timer = 0;
  return {
    get copied() {
      return copied;
    },
    mark() {
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        copied = false;
      }, hold);
    },
  };
};
