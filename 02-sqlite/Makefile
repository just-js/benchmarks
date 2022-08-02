#!/bin/bash
gcc -O3 -c -Wall -Wextra -Ideps/sqlite/build -o test.o test.c
gcc -static -mtune=native -march=native -flto -pthread -m64 -s -o test test.o deps/sqlite/build/.libs/libsqlite3.a