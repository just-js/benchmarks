#include <stdio.h>
#include <time.h>
#include <stdlib.h>
#include <stdint.h>

int total = 5;
int count = 100000000;
struct timespec t;

uint64_t hrtime() {
  clock_t clock_id = CLOCK_MONOTONIC;
  if (clock_gettime(clock_id, &t)) return 0;
  return t.tv_sec * (uint64_t) 1e9 + t.tv_nsec;
}

void bench () {
  float start, end;
  start = (float)clock() / (CLOCKS_PER_SEC / 1000);
  for (int i = 0; i < count; i++) hrtime();
  end = (float)clock() / (CLOCKS_PER_SEC / 1000);
  printf("time %.0f ms rate %.0f\n", (end - start), count / ((end - start) / 1000));
}

int main (int argc, char** argv) {
  if (argc > 1) total = atoi(argv[1]);
  if (argc > 2) count = atoi(argv[2]);
  while (total--) bench();
}
