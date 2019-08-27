from pip._vendor import pkg_resources
import sys


def find_on_path(path):
    dists = pkg_resources.find_on_path(None, path)
    dists = sorted(dists, key=lambda item: str(item))
    return dists


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else '.'

    dists = find_on_path(path)

    for dist in dists:
        print('{}=={}'.format(dist.project_name, dist.version))


if __name__ == '__main__':
    main()