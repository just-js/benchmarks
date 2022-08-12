#include <libusockets.h>
#include <stdlib.h>
#include <string.h>

const int SSL = 0;

struct http_socket {
	int offset;
};

struct http_context {
	char *response;
	int length;
};

void on_wakeup(struct us_loop_t *loop) {}
void on_pre(struct us_loop_t *loop) {}
void on_post(struct us_loop_t *loop) {}

struct us_socket_t *on_http_socket_writable(struct us_socket_t *s) {
	struct http_socket *http_socket = (struct http_socket *) us_socket_ext(SSL, s);
	struct http_context *http_context = (struct http_context *) us_socket_context_ext(SSL, us_socket_context(SSL, s));
	http_socket->offset += us_socket_write(SSL, s, http_context->response + http_socket->offset, http_context->length - http_socket->offset, 0);
	return s;
}

struct us_socket_t *on_http_socket_close(struct us_socket_t *s, int code, void *reason) {
	return s;
}

struct us_socket_t *on_http_socket_end(struct us_socket_t *s) {
	us_socket_shutdown(SSL, s);
	return us_socket_close(SSL, s, 0, NULL);
}

struct us_socket_t *on_http_socket_data(struct us_socket_t *s, char *data, int length) {
	struct http_socket *http_socket = (struct http_socket *) us_socket_ext(SSL, s);
	struct http_context *http_context = (struct http_context *) us_socket_context_ext(SSL, us_socket_context(SSL, s));
	http_socket->offset = us_socket_write(SSL, s, http_context->response, http_context->length, 0);
	us_socket_timeout(SSL, s, 30);
	return s;
}

struct us_socket_t *on_http_socket_open(struct us_socket_t *s, int is_client, char *ip, int ip_length) {
	struct http_socket *http_socket = (struct http_socket *) us_socket_ext(SSL, s);
	http_socket->offset = 0;
	us_socket_timeout(SSL, s, 30);
	return s;
}

struct us_socket_t *on_http_socket_timeout(struct us_socket_t *s) {
	return us_socket_close(SSL, s, 0, NULL);
}

int main() {
	struct us_loop_t *loop = us_create_loop(0, on_wakeup, on_pre, on_post, 0);
	struct us_socket_context_options_t options = {};
	struct us_socket_context_t *http_context = us_create_socket_context(SSL, loop, sizeof(struct http_context), options);
	const char body[] = "Hello, World!";
	struct http_context *http_context_ext = (struct http_context *) us_socket_context_ext(SSL, http_context);
	http_context_ext->response = (char *) malloc(128 + sizeof(body) - 1);
	http_context_ext->length = snprintf(http_context_ext->response, 128 + sizeof(body) - 1, "HTTP/1.1 200 OK\r\nServer: j\r\nDate: Fri, 12 Aug 2022 06:01:35 GMT\r\nContent-Type: text/plain\r\nContent-Length: %ld\r\n\r\n%s", sizeof(body) - 1, body);
	us_socket_context_on_open(SSL, http_context, on_http_socket_open);
	us_socket_context_on_data(SSL, http_context, on_http_socket_data);
	us_socket_context_on_writable(SSL, http_context, on_http_socket_writable);
	us_socket_context_on_close(SSL, http_context, on_http_socket_close);
	us_socket_context_on_timeout(SSL, http_context, on_http_socket_timeout);
	us_socket_context_on_end(SSL, http_context, on_http_socket_end);
	struct us_listen_socket_t *listen_socket = us_socket_context_listen(SSL, http_context, 0, 3000, 0, sizeof(struct http_socket));
	if (listen_socket) {
		us_loop_run(loop);
	} else {
		printf("Failed to listen!\n");
	}
}
