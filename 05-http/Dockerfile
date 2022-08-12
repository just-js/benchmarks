FROM benchmark:latest
WORKDIR /bench
ADD . .
RUN mkdir deps
RUN curl -L -o deps/usocket.tar.gz https://github.com/uNetworking/uSockets/archive/v0.8.1.tar.gz
RUN tar -zxvf deps/usocket.tar.gz
RUN make -C deps/uSockets-0.8.1/
RUN gcc -O3 -c -Wall -Wextra -Ideps/uSockets-0.8.1/src -o bench-usocket.o bench-usocket.c
RUN gcc -static -mtune=native -march=native -flto -pthread -m64 -s -o bench-usocket bench-usocket.o deps/uSockets-0.8.1/uSockets.a
RUN rm bench-usocket.o
RUN just build --clean --static bench-just-dumb-loop.js
#RUN apt clean all
#RUN rm -fr /var/lib/apt/lists
CMD ["/bin/bash"]
