# Infinite Scroll

**Task:** "Load more items when the user scrolls to the bottom."

## Without Ponytail

```bash
npm install react-infinite-scroll-component
```

```jsx
import InfiniteScroll from "react-infinite-scroll-component";

export function Feed({ items, fetchMore, hasMore }) {
  return (
    <InfiniteScroll
      dataLength={items.length}
      next={fetchMore}
      hasMore={hasMore}
      loader={<Spinner />}
      endMessage={<p>No more items</p>}
      scrollThreshold={0.9}
    >
      {items.map(item => <Card key={item.id} item={item} />)}
    </InfiniteScroll>
  );
}
```

A dependency to watch scroll position and fire a callback.

## With Ponytail

```jsx
// ponytail: IntersectionObserver does this, no scroll listener needed
import { useEffect, useRef } from "react";

export function Feed({ items, fetchMore, hasMore }) {
  const sentinel = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore) fetchMore();
    });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, fetchMore]);

  return (
    <>
      {items.map(item => <Card key={item.id} item={item} />)}
      <div ref={sentinel} />
    </>
  );
}
```

**1 dependency → 0 dependencies.** `IntersectionObserver` fires only when the sentinel enters the viewport, no scroll event, no throttling, no jank. Ships in every browser. The library wraps exactly this API.
