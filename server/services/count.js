const count = async (req, differentIndex = '') => {

    let index = '';

    differentIndex === '' ? index = req.params.index : index = differentIndex;

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');

    const tmpDocCount = await callWithRequest(req, 'count', {
        index: index,
        body: {}
    })

    const docCount = parseInt(tmpDocCount.count);

    return docCount;
};

export { count };
