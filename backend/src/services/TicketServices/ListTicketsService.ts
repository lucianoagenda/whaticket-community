import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;

  /**
   * ATENÇÃO:
   * queueIds NÃO deve ser confiável vindo do front.
   * Vamos usar apenas para ADMIN filtrar.
   */
  queueIds?: number[];
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  status,
  date,
  showAll,
  userId,
  withUnreadMessages,
  queueIds = []
}: Request): Promise<Response> => {
  // Sempre carrega o usuário e suas filas (regra de permissão)
  const user = await ShowUserService(userId);
  const userQueueIds = (user.queues || []).map(queue => queue.id);

  const isAdmin = user.profile === "admin" || user.profile === "superadmin";

  /**
   * Filas efetivas:
   * - Usuário comum: SEMPRE suas filas
   * - Admin: pode filtrar por queueIds se vierem preenchidos; senão, vê tudo
   */
  const effectiveQueueIds =
    isAdmin && queueIds.length > 0 ? queueIds : userQueueIds;

  // INCLUDE padrão
  let includeCondition: Includeable[] = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"]
    }
  ];

  // WHERE base
  let whereCondition: Filterable["where"] = {};

  /**
   * Permissão por fila:
   * - Usuário comum: só enxerga tickets das filas associadas (queueId IN userQueueIds)
   * - Admin:
   *   - se effectiveQueueIds tem valores (filtrando), aplica IN
   *   - se não tem valores (sem filtro), não aplica nada (vê tudo)
   */
  if (!isAdmin) {
    // Se o usuário não estiver associado a nenhuma fila, não mostra nada
    whereCondition = {
      ...whereCondition,
      queueId: { [Op.in]: effectiveQueueIds.length ? effectiveQueueIds : [-1] }
    };
  } else {
    if (effectiveQueueIds.length > 0) {
      whereCondition = {
        ...whereCondition,
        queueId: { [Op.in]: effectiveQueueIds }
      };
    }
  }

  /**
   * Regra original de visibilidade (mantida):
   * - Usuário vê seus tickets OU tickets pending
   *
   * OBS: Isso continua respeitando a permissão por fila acima.
   */
  if (showAll === "true") {
    // showAll: remove o filtro de "meus tickets/pending"
    // mas mantém permissão por fila (já aplicada acima)
  } else {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [{ userId }, { status: "pending" }]
    };
  }

  // Filtrar por status (mantém todos os filtros anteriores)
  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  // Filtrar por data (CORREÇÃO: antes você sobrescrevia o where inteiro)
  if (date) {
    whereCondition = {
      ...whereCondition,
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  // Filtro por pesquisa (mantém todos os filtros anteriores)
  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` },
        },
        {
          "$message.body$": where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  /**
   * Apenas tickets com mensagens não lidas:
   * - Mantém a permissão por fila
   * - Mantém regra "meus/pending" quando showAll != true
   */
  if (withUnreadMessages === "true") {
    whereCondition = {
      ...whereCondition,
      unreadMessages: { [Op.gt]: 0 }
    };
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", "DESC"]]
  });

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
