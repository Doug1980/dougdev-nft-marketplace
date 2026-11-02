# Lighthouse summary (median of 3 runs)

- **date**: 2026-11-02T08:33:14.142Z
- **lighthouse**: 13.6.0
- **browser**: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36
- **node**: v22.20.0
- **os**: Windows_NT 10.0.26200 (x64)
- **cpu**: 13th Gen Intel(R) Core(TM) i7-13650HX
- **vite**: ^8.3.5
- **conditions**: vite preview (optimized build), mocks on, default scenario, 3 runs per page/profile, fresh Chrome profile per run, Lighthouse default throttling

| Page | Profile | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | mobile | 76 ⚠️ | 96 | 100 | 92 | 4927 ms | 0.000 | 268 ms |
| home | desktop | 99 | 97 | 100 | 92 | 881 ms | 0.002 | 0 ms |
| nft-detail | mobile | 83 ⚠️ | 100 | 100 | 92 | 4617 ms | 0.000 | 105 ms |
| nft-detail | desktop | 99 | 100 | 100 | 92 | 965 ms | 0.000 | 0 ms |

Targets: performance ≥ 90, accessibility ≥ 95, best-practices ≥ 95, seo ≥ 90. ⚠️ marks a median below target.
