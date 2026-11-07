import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePager } from "./use-pager";

describe("usePager", () => {
  it("slices items into pages of the given size", () => {
    const { result } = renderHook(() => usePager([1, 2, 3, 4, 5], 2));
    expect(result.current.slice).toEqual([1, 2]);
    expect(result.current.pages).toBe(3);
    expect(result.current.from).toBe(1);
    expect(result.current.to).toBe(2);
    expect(result.current.total).toBe(5);
  });

  it("advances and retreats pages, clamping at the ends", () => {
    const { result } = renderHook(() => usePager([1, 2, 3, 4, 5], 2));
    act(() => result.current.prev()); // already at page 0, stays
    expect(result.current.page).toBe(0);
    act(() => result.current.next());
    expect(result.current.page).toBe(1);
    expect(result.current.slice).toEqual([3, 4]);
    act(() => result.current.next());
    act(() => result.current.next()); // past the last page, clamps
    expect(result.current.page).toBe(2);
    expect(result.current.slice).toEqual([5]);
    expect(result.current.to).toBe(5);
  });

  it("goToIndex jumps to the page containing that item", () => {
    const { result } = renderHook(() => usePager([1, 2, 3, 4, 5, 6, 7], 3));
    act(() => result.current.goToIndex(4));
    expect(result.current.page).toBe(1); // item 4 (index 4) is on page floor(4/3)=1
    expect(result.current.slice).toEqual([4, 5, 6]);
  });

  it("clamps the current page when items shrink", () => {
    const { result, rerender } = renderHook(({ items }: { items: number[] }) => usePager(items, 2), {
      initialProps: { items: [1, 2, 3, 4, 5] },
    });
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.page).toBe(2);
    rerender({ items: [1, 2] });
    expect(result.current.page).toBe(0);
    expect(result.current.slice).toEqual([1, 2]);
  });

  it("handles an empty list without dividing by zero", () => {
    const { result } = renderHook(() => usePager([] as number[], 5));
    expect(result.current.pages).toBe(1);
    expect(result.current.slice).toEqual([]);
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(0);
  });
});
